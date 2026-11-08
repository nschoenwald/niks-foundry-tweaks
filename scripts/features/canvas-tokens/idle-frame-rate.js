/**
 * Feature: Idle Frame Rate
 * Description: Lowers the canvas frame rate while nobody interacts with the game and nothing is moving, and goes
 * back to the normal frame rate on the next mouse movement, key press, token movement or chat message. Saves
 * battery, heat and fan noise on laptops while the table talks.
 *
 * How: Foundry renders the canvas from `canvas.app.ticker`, capped by `maxFPS` (set from the core Maximum Framerate
 * and Performance Mode settings in `Canvas#_configurePerformanceMode`). While idle, only `canvas.app.ticker.maxFPS`
 * is lowered; waking restores it to `canvas.performance.fps`, the value core computed. `PIXI.Ticker.shared` (video
 * frame updates without requestVideoFrameCallback, other modules' deferred work) is left alone. The core setting is
 * never written.
 *
 * Idle means: no pointer, wheel or key input on the page, no running `CanvasAnimation` (token movement, pings,
 * camera pans), and no relevant document change (tokens, tiles, lights, templates, regions, drawings, chat
 * messages) for the chosen delay.
 *
 * Compatibility: Prime Performance doesn't change the ticker or its frame cap (its GPU overlay only reads the core
 * Maximum Framerate setting), and its deferred caching runs on `PIXI.Ticker.shared`, which this feature doesn't touch.
 *
 * @introduced v14.2.0
 */
import { MODULE_ID, debug, getSetting, isFeatureActive, clearSettingsCache } from "../../context.js";

/**
 * How often to check for idle / running animations. Short, so animations without a document change (pings from
 * other users arrive over the socket) wake the canvas within a quarter second. The check itself is trivial.
 */
const CHECK_INTERVAL_MS = 250;

/** DOM events that count as activity. */
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "wheel", "keydown"];

/** Document changes that count as activity (they usually animate something or come with an animation). */
const ACTIVITY_DOCUMENTS = ["Token", "Tile", "AmbientLight", "AmbientSound", "MeasuredTemplate", "Region", "Drawing", "Note", "Wall", "ChatMessage", "Combat", "Combatant"];

let _active = false;
let _listenersAdded = false;
let _idle = false;
let _lastActivity = performance.now();
let _interval = null;

/** @returns {number} Idle delay in milliseconds */
function idleDelay() {
    return (Number(getSetting("idleFrameRateDelay")) || 30) * 1000;
}

/** @returns {number} Frame rate while idle */
function idleFps() {
    return Number(getSetting("idleFrameRate")) || 20;
}

/** The frame cap core configured, which applies while not idle. 0 means uncapped. */
function normalFps() {
    return canvas?.performance?.fps ?? game.settings.get("core", "maxFPS");
}

/**
 * Restores the normal frame rate.
 * @param {string} reason
 */
function wake(reason) {
    _lastActivity = performance.now();
    if (!_idle) return;
    _idle = false;
    const ticker = canvas?.app?.ticker;
    if (ticker) ticker.maxFPS = normalFps();
    debug(`Idle Frame Rate | back to ${normalFps() || "uncapped"} FPS (${reason})`);
}

function onActivityEvent() {
    _lastActivity = performance.now();
    if (_idle) wake("input");
}

/** Whether a canvas animation (token movement, ping, pan) is running. */
function isAnimating() {
    const animations = foundry.canvas.animation.CanvasAnimation.animations;
    for (const _key in animations) return true;
    return false;
}

/** Periodic check: become idle, or stay awake while something animates. */
function check() {
    if (!_active || !canvas?.ready) return;
    const ticker = canvas.app?.ticker;
    if (!ticker) return;

    if (isAnimating()) {
        if (_idle) wake("animation");
        else _lastActivity = performance.now();
        return;
    }

    const target = idleFps();
    const normal = normalFps();
    // Nothing to gain if the normal cap is already at or below the idle frame rate
    if (normal && (normal <= target)) return;

    if (_idle) {
        // Core may have reapplied its frame cap (canvas redraw, settings change) while idle
        if (ticker.maxFPS !== target) ticker.maxFPS = target;
        return;
    }
    if ((performance.now() - _lastActivity) < idleDelay()) return;
    _idle = true;
    ticker.maxFPS = target;
    debug(`Idle Frame Rate | idle, canvas limited to ${target} FPS`);
}

function addListeners() {
    if (_listenersAdded) return;
    _listenersAdded = true;
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivityEvent, { capture: true, passive: true });
    for (const name of ACTIVITY_DOCUMENTS) {
        for (const action of ["create", "update", "delete"]) Hooks.on(`${action}${name}`, () => wake(`${action}${name}`));
    }
    // A redrawn canvas starts with core's cap; count the redraw as activity
    Hooks.on("canvasReady", () => {
        _idle = false;
        _lastActivity = performance.now();
    });
}

/**
 * Turns the feature on or off following the world and personal settings. Safe to call repeatedly.
 */
export function updateIdleFrameRate() {
    for (const key of ["enableIdleFrameRate", "clientEnableIdleFrameRate", "idleFrameRate", "idleFrameRateDelay"]) {
        clearSettingsCache(`${MODULE_ID}.${key}`);
    }
    _active = isFeatureActive("enableIdleFrameRate", "clientEnableIdleFrameRate");
    if (_active) {
        addListeners();
        _lastActivity = performance.now();
        _interval ??= setInterval(check, CHECK_INTERVAL_MS);
    } else {
        if (_interval) clearInterval(_interval);
        _interval = null;
        wake("feature turned off");
    }
    // Apply a changed idle frame rate right away
    if (_active && _idle && canvas?.app?.ticker) canvas.app.ticker.maxFPS = idleFps();
    debug(`Idle Frame Rate ${_active ? "enabled" : "disabled"}`);
}
