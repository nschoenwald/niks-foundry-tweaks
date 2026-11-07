/**
 * Feature: Hide Private GM Rolls from Players
 * Description: Completely suppresses whispered, private, and blind GM rolls from player chat logs, preventing empty placeholder cards with hidden content from revealing secret rolls.
 *
 * Extension `hidePrivateGMRolls` (system add-ons, see api.js): `isRoll(message)` marks system roll cards that
 * carry no core `rolls` (e.g. dnd5e's `flags.dnd5e.roll`).
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.30.0)
 * @updated v14.0.0 (system roll detection comes from add-on extensions)
 * @updated v14.1.1 (Visibility wrapper always chains, fixing the libWrapper conflict warning with Nik's DnD5e Tweaks)
 */
import { getSetting, debug } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";
import { getExtensions } from "../../settings-registry.js";

/**
 * Whether an add-on recognizes the message as a roll.
 * @param {ChatMessage} message
 * @returns {boolean}
 */
function _isSystemRoll(message) {
    return getExtensions("hidePrivateGMRolls").some(ext => {
        try {
            return (typeof ext.isRoll === "function") && Boolean(ext.isRoll(message));
        } catch (err) {
            debug("Hide Private GM Rolls: extension isRoll failed", err);
            return false;
        }
    });
}

/**
 * Hide Private GM Rolls from Players
 *
 * In Foundry VTT, when a GM makes a whispered, private, or blind roll (e.g. /gmroll,
 * /blindroll, /selfroll, or rolling an activity/attack card privately), ChatMessage.prototype.visible
 * contains a hardcoded core check: `if ( this.isRoll ) return true;`.
 *
 * Because of this override, Foundry displays an empty chat card with hidden contents ("???")
 * to players, alerting them that the GM rolled behind the screen.
 *
 * This feature patches `ChatMessage.prototype.visible` so that whispered, private, and blind
 * rolls authored by a GM are completely invisible to non-GM players (unless the player is an
 * explicit whisper recipient).
 */

export function initHidePrivateGMRolls() {
    patchMethod(
        "CONFIG.ChatMessage.documentClass.prototype.visible#get",
        function(wrapped) {
            // Always chain first: Nik's DnD5e Tweaks wraps the same getter (Player Damage Prompt), and returning
            // without calling `wrapped` made libWrapper report a conflict between the two modules.
            // This wrapper only ever hides messages, so the result is the same.
            const visible = wrapped();
            if (!visible) return visible;

            // If the feature is disabled, use default Foundry behavior
            if (!getSetting("enableHidePrivateGMRolls")) return visible;

            // GMs should always see all messages according to core logic
            if (game.user?.isGM) return visible;

            // Determine if the message author is a GM
            const author = this.author ?? game.users?.get(this.user ?? this._source?.author);

            // If the message was not authored by a GM, use default behavior
            if (!author?.isGM) return visible;

            // The author is a GM, and current user is a non-GM player.
            // Check if this message is a whispered, private, or blind roll.
            const hasWhisper = Array.isArray(this.whisper) && this.whisper.length > 0;
            const isBlind = Boolean(this.blind);
            const isRoll = Boolean(
                this.isRoll
                || (this.rolls && this.rolls.length > 0)
                || this.type === "roll"
                || _isSystemRoll(this)
            );

            if ((hasWhisper || isBlind) && isRoll) {
                // Blind rolls by GM are never visible to non-GM players
                if (isBlind) return false;

                // For whispered rolls, only visible if the player is explicitly in the whisper list
                if (!hasWhisper || !this.whisper.includes(game.user.id)) return false;
            }

            return visible;
        },
        "WRAPPER"
    );

    // Defense-in-depth: if any other module manually rendered or injected an invisible message
    Hooks.on("renderChatMessageHTML", (message, html) => {
        if (!getSetting("enableHidePrivateGMRolls")) return;
        if (game.user?.isGM) return;
        if (!message.visible) {
            const el = html instanceof HTMLElement ? html : html?.[0];
            if (el) {
                el.style.display = "none";
                el.remove?.();
            }
        }
    });

    debug("Hide Private GM Rolls | Initialized");
}
