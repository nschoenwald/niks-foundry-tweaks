/**
 * Feature: Throttled Vision Updates While Moving
 * Description: While a token's movement is animated, recomputes its vision and attached light a limited number of
 * times per second instead of every frame. The final position is always computed exactly.
 *
 * Why: with Foundry's "Animate Token Vision" setting on, `Token#_onAnimationUpdate` calls `initializeSources()` on
 * every animation frame of a moving token that has sight or emits light. That recomputes the vision and light
 * polygons against every wall (and refreshes perception), which is the main CPU cost of token movement in scenes
 * with many walls. The only core alternative is turning vision animation off entirely.
 *
 * How: `Token#_onAnimationUpdate` is wrapped to mark the frame; `Token#initializeSources` skips the update when it is
 * called from a non-final animation frame and this token's sources were updated less than one interval ago.
 * A skipped update is caught up on the next frame after the interval, on the final frame
 * (`context.time >= context.duration`), by `stopAnimation()` (duration 0), or by a timer if the animation stops
 * between frames. Calls outside animation frames (and `deleted: true`) are never skipped.
 *
 * Trade-off: fog of war is revealed from the sampled positions, so a token moving very fast past a narrow opening can
 * reveal slightly less than with per-frame updates. The end position is always exact.
 *
 * Compatibility: Prime Performance doesn't wrap token animation, `initializeSources` or perception.
 *
 * @introduced v14.2.0
 * @updated v14.2.2 (Personal setting can also turn it on when the GM left it off: Use World Setting / On / Off)
 */
import { MODULE_ID, debug, getSetting, clearSettingsCache } from "../../context.js";
import { isFeatureOnForUser } from "../../utils/personal-override.js";
import { patchMethod } from "../../utils/patch-helper.js";

let _active = false;
let _patched = false;

/**
 * Per-token state.
 * @type {WeakMap<object, {lastInit: number, pending: boolean, timer: number|null}>}
 */
const _states = new WeakMap();

/** The animation frame currently being processed per token (set while `_onAnimationUpdate` runs). */
const _frames = new WeakMap();

/** @returns {number} Minimum milliseconds between source updates while moving */
function intervalMs() {
    const rate = Number(getSetting("visionUpdateRate")) || 20;
    return 1000 / rate;
}

function getState(token) {
    let state = _states.get(token);
    if (!state) {
        state = { lastInit: -Infinity, pending: false, timer: null };
        _states.set(token, state);
    }
    return state;
}

/**
 * Runs a skipped source update if it is still outstanding (the animation stopped between frames).
 * @param {object} token
 */
function catchUp(token) {
    const state = _states.get(token);
    if (!state) return;
    state.timer = null;
    if (!state.pending || token.destroyed || !token.scene) return;
    state.pending = false;
    state.lastInit = performance.now();
    token.initializeSources();
}

function registerPatches() {
    if (_patched) return;
    _patched = true;

    patchMethod("CONFIG.Token.objectClass.prototype._onAnimationUpdate", function throttledOnAnimationUpdate(wrapped, changed, context) {
        if (!_active) return wrapped(changed, context);
        const final = !context || !(context.duration > 0) || (context.time >= context.duration);
        _frames.set(this, { final });
        try {
            return wrapped(changed, context);
        } finally {
            _frames.delete(this);
        }
    }, "WRAPPER");

    patchMethod("CONFIG.Token.objectClass.prototype.initializeSources", function throttledInitializeSources(wrapped, options = {}) {
        const frame = _frames.get(this);
        if (!_active || !frame || options?.deleted) return wrapped(options);

        const state = getState(this);
        const now = performance.now();
        if (frame.final || ((now - state.lastInit) >= intervalMs())) {
            state.pending = false;
            if (state.timer) clearTimeout(state.timer);
            state.timer = null;
            state.lastInit = now;
            return wrapped(options);
        }

        // Skip this frame; make sure the update happens even if no further frame arrives
        state.pending = true;
        if (!state.timer) {
            const token = this;
            state.timer = setTimeout(() => catchUp(token), Math.ceil(intervalMs()));
        }
    }, "MIXED");
}

/**
 * Turns the feature on or off following the world and personal settings. Safe to call repeatedly.
 */
export function updateVisionUpdateThrottle() {
    for (const key of ["enableVisionUpdateThrottle", "clientVisionUpdateThrottle", "visionUpdateRate"]) {
        clearSettingsCache(`${MODULE_ID}.${key}`);
    }
    _active = isFeatureOnForUser("enableVisionUpdateThrottle", "clientVisionUpdateThrottle");
    if (_active) registerPatches();
    debug(`Throttled Vision Updates While Moving ${_active ? "enabled" : "disabled"}`);
}
