/**
 * Feature: Batched Sidebar Updates
 * Description: Merges bursts of re-render requests for sidebar directories (Actors, Items, Journal, Scenes…) and the
 * Combat Tracker into one render, postpones re-renders of sidebar tabs that aren't open until they are opened, and
 * skips rebuilding the Actors / Items folder tree for updates that can't change it.
 *
 * Why: core re-renders the whole Combat Tracker for every change to a combatant's actor (8 creatures hit by one
 * area spell = 8 full renders, one after another) and re-renders a directory for every created or deleted document,
 * also while another sidebar tab is open. And every update of a world Actor or Item (e.g. a linked actor's HP)
 * rebuilds that collection's whole folder tree, even though the directory itself doesn't re-render.
 *
 * How:
 *  - `render()` of DocumentDirectory and CombatTracker is wrapped. The first plain request renders at once; further
 *    plain requests within BATCH_WINDOW_MS are merged into one render at the end of the window. Requests that
 *    carry anything else (force, a viewed combat, position…) and turn changes (`renderContext: "updateCombat"`,
 *    which scrolls the active combatant into view) render at once, as before.
 *  - A plain request for a sidebar tab that isn't the active one (and isn't popped out) only marks it as outdated;
 *    it renders when the tab is opened (`changeSidebarTab`).
 *  - `WorldCollection#_onModifyContents` skips `initializeTree()` for Actor / Item updates whose changes contain
 *    none of the keys the tree depends on (name, sort, folder, ownership).
 *
 * @introduced v14.2.0
 * @updated v14.2.2 (Personal setting can also turn it on when the GM left it off: Use World Setting / On / Off)
 */
import { MODULE_ID, debug, clearSettingsCache } from "../../context.js";
import { isFeatureOnForUser } from "../../utils/personal-override.js";
import { patchMethod } from "../../utils/patch-helper.js";

/** Requests within this many milliseconds after a render are merged into one render. */
const BATCH_WINDOW_MS = 100;

/** Options a merged ("plain") request may carry. Anything else renders immediately. */
const PLAIN_OPTION_KEYS = new Set(["force", "parts", "renderContext", "renderData"]);

/** Document fields the folder tree depends on (WorldCollection#_getVisibleTreeContents, sorting, folders). */
const TREE_KEYS = ["name", "sort", "folder", "ownership"];

/** World collections whose frequent updates (HP, uses, quantities…) can skip the tree rebuild. */
const TREE_SKIP_DOCUMENT_NAMES = new Set(["Actor", "Item"]);

/**
 * Per-application batching state.
 * @typedef {object} BatchState
 * @property {number} lastRender           performance.now() of the last render that went through
 * @property {number|null} timer           Pending merged render
 * @property {object|null} pending         Merged options of the pending render
 * @property {Promise|null} promise        Resolves when the pending render is done
 * @property {Function|null} resolve
 * @property {boolean} flushing            The merged render is being started (bypasses batching)
 * @property {boolean} deferred            A request arrived while the tab wasn't visible
 */

/** @type {WeakMap<object, BatchState>} */
const _states = new WeakMap();

/** Whether the patches are registered (they stay registered; turning the feature off makes them pass through). */
let _patched = false;

/** Cached on/off state, refreshed by updateBatchedSidebarUpdates(). */
let _active = false;

/**
 * @param {object} app
 * @returns {BatchState}
 */
function getState(app) {
    let state = _states.get(app);
    if (!state) {
        state = { lastRender: -Infinity, timer: null, pending: null, promise: null, resolve: null, flushing: false, deferred: false };
        _states.set(app, state);
    }
    return state;
}

/**
 * Whether a render request only asks to bring the app up to date, so it can be merged with others.
 * @param {object} options
 * @returns {boolean}
 */
function isPlainRequest(options) {
    if (options.force) return false;
    if (options.renderContext === "updateCombat") return false;
    for (const key of Object.keys(options)) {
        if (!PLAIN_OPTION_KEYS.has(key)) return false;
    }
    return true;
}

/**
 * Merges two plain render requests. The result renders at least everything either of them would have rendered.
 * @param {object|null} a
 * @param {object} b
 * @returns {object}
 */
function mergeOptions(a, b) {
    if (!a) return { ...b };
    const merged = {};

    // Parts: all parts if either asked for all of them
    if (Array.isArray(a.parts) && Array.isArray(b.parts)) merged.parts = [...new Set([...a.parts, ...b.parts])];

    // Context and data: only kept when both requests agree. Without a context, directories render unconditionally.
    if (a.renderContext && (a.renderContext === b.renderContext)) {
        merged.renderContext = a.renderContext;
        if (Array.isArray(a.renderData) && Array.isArray(b.renderData)) merged.renderData = [...a.renderData, ...b.renderData];
        else if (!a.renderData && !b.renderData) { /* neither carried data */ }
        else delete merged.renderContext;
    }
    return merged;
}

/**
 * Whether the app is a sidebar tab that is currently not shown (another tab is active and it isn't popped out).
 * @param {object} app
 * @returns {boolean}
 */
function isHiddenSidebarTab(app) {
    if (app.isPopout) return false;
    if (!(app instanceof foundry.applications.sidebar.AbstractSidebarTab)) return false;
    return app.active === false;
}

/**
 * Cancels a pending merged render (a full render that is about to run covers it) and resolves its waiters.
 * @param {BatchState} state
 * @param {Promise} [renderPromise]   The render that replaces it
 */
function cancelPending(state, renderPromise) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.pending = null;
    const resolve = state.resolve;
    state.promise = null;
    state.resolve = null;
    if (resolve) resolve(renderPromise);
}

/**
 * Starts the pending merged render of an app.
 * @param {object} app
 */
function flush(app) {
    const state = getState(app);
    const options = state.pending ?? {};
    const resolve = state.resolve;
    state.timer = null;
    state.pending = null;
    state.promise = null;
    state.resolve = null;
    state.lastRender = performance.now();

    // A tab that was closed or hidden in the meantime renders when it's needed again
    if (!app.rendered) {
        resolve?.(app);
        return;
    }
    if (isHiddenSidebarTab(app)) {
        state.deferred = true;
        resolve?.(app);
        return;
    }

    let promise;
    state.flushing = true;
    try {
        promise = app.render(options);
    } finally {
        state.flushing = false;
    }
    debug(`Batched Sidebar Updates | ${app.constructor.name}: rendered merged request`, options);
    resolve?.(promise);
}

/**
 * Wrapper for DocumentDirectory#render and CombatTracker#render.
 * @this {foundry.applications.api.ApplicationV2}
 * @param {Function} wrapped
 * @param {object|boolean} [options]
 * @param {object} [_options]
 * @returns {Promise<foundry.applications.api.ApplicationV2>}
 */
function batchedRender(wrapped, options = {}, _options = {}) {
    if (!_active) return wrapped(options, _options);
    const state = getState(this);
    if (state.flushing) return wrapped(options, _options);

    // Legacy boolean signature: render(force, options)
    let request = options;
    if (typeof options === "boolean") request = { ..._options, force: options };
    if (!request || (typeof request !== "object")) return wrapped(options, _options);

    // First renders, forced renders and requests with extra options go through untouched.
    // A full render also covers a pending merged one.
    if (!this.rendered || !isPlainRequest(request)) {
        const promise = wrapped(options, _options);
        state.lastRender = performance.now();
        if (!request.parts) {
            state.deferred = false;
            cancelPending(state, promise);
        }
        return promise;
    }

    // Requests the app would ignore anyway (e.g. a directory and an update that doesn't touch a shown field)
    try {
        if (this._canRender(request) === false) return wrapped(options, _options);
    } catch {
        return wrapped(options, _options);
    }

    // Tab not visible: render when it's opened
    if (isHiddenSidebarTab(this)) {
        if (!state.deferred) debug(`Batched Sidebar Updates | ${this.constructor.name}: postponed until the tab is opened`);
        state.deferred = true;
        cancelPending(state, Promise.resolve(this));
        return Promise.resolve(this);
    }

    // Leading request renders at once
    const now = performance.now();
    if (!state.timer && ((now - state.lastRender) >= BATCH_WINDOW_MS)) {
        state.lastRender = now;
        return wrapped(options, _options);
    }

    // Further requests within the window are merged into one render at its end
    state.pending = mergeOptions(state.pending, request);
    if (!state.timer) {
        state.promise = new Promise(resolve => { state.resolve = resolve; });
        const delay = Math.max(0, BATCH_WINDOW_MS - (now - state.lastRender));
        state.timer = setTimeout(() => flush(this), delay);
    }
    return state.promise.then(() => this);
}

/**
 * Renders a sidebar tab that missed updates while another tab was open.
 * @param {object} app   The newly active sidebar tab
 */
function onChangeSidebarTab(app) {
    if (!app) return;
    const state = _states.get(app);
    if (!state?.deferred) return;
    state.deferred = false;
    if (!app.rendered) return;
    debug(`Batched Sidebar Updates | ${app.constructor.name}: rendering postponed updates`);
    state.flushing = true;
    try {
        app.render();
    } finally {
        state.flushing = false;
    }
    state.lastRender = performance.now();
}

/**
 * Whether a world collection modification can leave the folder tree as it is.
 * @param {foundry.documents.abstract.WorldCollection} collection
 * @param {string} action
 * @param {object[]} result
 * @param {object} operation
 * @returns {boolean}
 */
function canSkipTreeRebuild(collection, action, result, operation) {
    if (action !== "update" || operation?.parent) return false;
    if (!TREE_SKIP_DOCUMENT_NAMES.has(collection.documentName)) return false;
    if (!Array.isArray(result) || !result.length) return false;
    return result.every(change => change && (typeof change === "object") && !TREE_KEYS.some(key => key in change));
}

/**
 * Registers the patches once. They do nothing while the feature is off.
 */
function registerPatches() {
    if (_patched) return;
    _patched = true;

    patchMethod("foundry.applications.sidebar.DocumentDirectory.prototype.render", batchedRender, "MIXED");
    patchMethod("foundry.applications.sidebar.tabs.CombatTracker.prototype.render", batchedRender, "MIXED");

    patchMethod("foundry.documents.abstract.WorldCollection.prototype._onModifyContents",
        function batchedOnModifyContents(wrapped, action, documents, result, operation, user) {
            if (!_active || !canSkipTreeRebuild(this, action, result, operation)) {
                return wrapped(action, documents, result, operation, user);
            }
            this._nftSkipTreeRebuild = true;
            try {
                return wrapped(action, documents, result, operation, user);
            } finally {
                delete this._nftSkipTreeRebuild;
            }
        }, "WRAPPER");

    patchMethod("foundry.documents.abstract.WorldCollection.prototype.initializeTree",
        function batchedInitializeTree(wrapped, ...args) {
            if (this._nftSkipTreeRebuild) return;
            return wrapped(...args);
        }, "MIXED");

    Hooks.on("changeSidebarTab", onChangeSidebarTab);
}

/**
 * Turns the feature on or off following the world and personal settings. Safe to call repeatedly.
 */
export function updateBatchedSidebarUpdates() {
    clearSettingsCache(`${MODULE_ID}.enableBatchedSidebarUpdates`);
    clearSettingsCache(`${MODULE_ID}.clientBatchedSidebarUpdates`);
    const active = isFeatureOnForUser("enableBatchedSidebarUpdates", "clientBatchedSidebarUpdates");
    if (active) registerPatches();
    const wasActive = _active;
    _active = active;

    // Turning it off: bring every tab with postponed or pending updates up to date
    if (wasActive && !active) {
        const apps = [ui.combat, ...Object.values(ui.sidebar?.popouts ?? {})];
        for (const key of ["actors", "items", "journal", "scenes", "tables", "cards", "playlists", "macros"]) apps.push(ui[key]);
        for (const app of apps) {
            const state = app && _states.get(app);
            if (!state) continue;
            const hadWork = state.deferred || state.timer;
            cancelPending(state, Promise.resolve(app));
            state.deferred = false;
            if (hadWork && app.rendered) app.render();
        }
    }
    debug(`Batched Sidebar Updates ${active ? "enabled" : "disabled"}`);
}
