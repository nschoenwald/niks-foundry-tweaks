/**
 * Feature: Delayed Disconnect Warning
 * Description: Holds back core's "lost connection" error for a few seconds, and drops it (with the matching
 * "re-established" message) when the socket reconnects in that time.
 *
 * @introduced v14.6.0
 */
import { isFeatureActive, getSetting, debug } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";

/**
 * Delayed Disconnect Warning
 *
 * Core (`Game.connect`, client/game.mjs) shows an error toast on every socket `disconnect` and an info toast on every
 * `reconnect`. socket.io retries every 500ms, so a short network hiccup produces both toasts within a second.
 * The listeners are closures inside `Game.connect`, so the toasts are caught in `Notifications#notify` by their exact
 * (unlocalized) text:
 *   - The "lost connection" error is held back for `disconnectWarningDelay` seconds (world setting, 0–60, default 5).
 *     If the socket is still disconnected then, it is shown. 0 passes it through right away.
 *   - The "re-established" info is dropped while the error is still held back (the user never saw the error);
 *     otherwise it is shown as usual.
 * Core reloads the page when a reconnect takes 5 seconds or longer, and gives up after 10 attempts; both are untouched.
 * With a delay above 5 seconds, a reconnect after 5 seconds still reloads the page, just without the toasts.
 */

/** Upper bound for the delay setting, in seconds. */
const MAX_DELAY_SECONDS = 60;

/**
 * How long a disconnect has to last before the warning is shown.
 * @returns {number} Milliseconds
 */
function _getDelayMs() {
    const seconds = Number(getSetting("disconnectWarningDelay"));
    if (!Number.isFinite(seconds)) return 5000;
    return Math.clamp(seconds, 0, MAX_DELAY_SECONDS) * 1000;
}

/** Core's message on socket disconnect (client/game.mjs, `Game.connect`). */
const DISCONNECT_MESSAGE = "You have lost connection to the server, attempting to re-establish.";

/** Core's message on socket reconnect (client/game.mjs, `Game.connect`). Built lazily: CONST is ready by then. */
const reconnectMessage = () => `${CONST.vtt} | Server connection re-established.`;

/** Timer of the held-back disconnect warning, or null. */
let _pendingTimer = null;

/** Set while the held-back warning is shown, so the wrapper lets it through. */
let _bypass = false;

export function initDelayedDisconnectWarning() {
    patchMethod("foundry.applications.ui.Notifications.prototype.notify", _onNotify, "MIXED");
}

/**
 * @param {Function} wrapped
 * @param {string|object} message
 * @param {string} [type]
 * @param {object} [options]
 */
function _onNotify(wrapped, message, type, options) {
    if (_bypass || (typeof message !== "string")) return wrapped(message, type, options);

    if ((message === DISCONNECT_MESSAGE) && isFeatureActive("enableDelayedDisconnectWarning", "clientEnableDelayedDisconnectWarning")) {
        const delayMs = _getDelayMs();
        if (delayMs <= 0) return wrapped(message, type, options);
        if (_pendingTimer) clearTimeout(_pendingTimer);
        debug(`Delayed Disconnect Warning: socket disconnected, holding the warning back for ${delayMs / 1000}s.`);
        _pendingTimer = setTimeout(() => {
            _pendingTimer = null;
            if (game.socket?.connected) return;
            _bypass = true;
            try {
                ui.notifications.notify(message, type, options);
            } finally {
                _bypass = false;
            }
        }, delayMs);
        return undefined;
    }

    if (_pendingTimer && (message === reconnectMessage())) {
        clearTimeout(_pendingTimer);
        _pendingTimer = null;
        console.log(`${CONST.vtt} | Server connection re-established after a short disconnect (warning suppressed by Nik's Foundry Tweaks).`);
        return undefined;
    }

    return wrapped(message, type, options);
}
