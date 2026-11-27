/**
 * Feature: Auto-Add Tokens to Combat
 * Description: Automatically adds new tokens created or dragged to the canvas during an ongoing combat encounter into the active combat.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.16.0)
 * Extension `autoAddTokensToCombat` (system add-ons, see api.js): `skipToken(tokenDocument)` leaves a token out.
 *
 * @updated niks-dnd5e-tweaks v14.57.0 (Active GM check uses the V14 API)
 * @updated v14.0.0 (the summon check moved to Nik's DnD5e Tweaks as an extension)
 * @updated v14.21.1 (uses the combat of the token's own scene, not the one the GM is viewing)
 */
import { MODULE_ID, getSetting, debug } from "../../context.js";
import { getExtensions } from "../../settings-registry.js";

/**
 * Auto-Add Tokens to Combat & Roll Initiative
 *
 * Automatically adds tokens to the active combat encounter and rolls their initiative
 * when they are created or dragged to the canvas during combat.
 */

export function initAutoAddTokensToCombat() {
    Hooks.on("createToken", _onCreateToken);
    debug("Auto-Add Tokens to Combat | Initialized");
}

/**
 * Handler for createToken hook.
 * @param {TokenDocument} tokenDocument
 * @param {object} options
 * @param {string} userId
 */
function _onCreateToken(tokenDocument, options, userId) {
    try {
        if (!getSetting("enableAutoAddTokensToCombat")) return;

        // Primary GM check to ensure single client execution
        const activeGM = game.users.activeGM;
        if (!activeGM?.isSelf) return;

        // The combat of the scene the token was created on. `game.combat` is the combat of the scene this GM
        // views, which may be another one; a combat not linked to any scene takes tokens from every scene.
        const tokenScene = tokenDocument.parent;
        const combats = game.combats?.contents ?? [];
        const onScene = c => c.scene && tokenScene && (c.scene.id === tokenScene.id);
        const combat = combats.find(c => c.active && onScene(c))
            ?? combats.find(c => c.started && onScene(c))
            ?? ((game.combat && !game.combat.scene) ? game.combat : null);
        if (!combat) return;

        // Prevent duplicate combatants if token is already in combat
        const existingCombatant = combat.combatants.some(c => c.tokenId === tokenDocument.id);
        if (existingCombatant) return;

        // Skip tokens an add-on handles itself (e.g. dnd5e summons)
        if (_isSkippedToken(tokenDocument)) {
            debug(`Auto-Add Tokens to Combat | Skipping token "${tokenDocument.name}" (${tokenDocument.id}), left out by an add-on.`);
            return;
        }

        debug(`Auto-adding token "${tokenDocument.name}" (${tokenDocument.id}) to combat ${combat.id} and rolling initiative.`);

        queueMicrotask(async () => {
            try {
                await combat.createEmbeddedDocuments("Combatant", [{
                    tokenId: tokenDocument.id,
                    sceneId: tokenScene?.id,
                    actorId: tokenDocument.actorId,
                    hidden: tokenDocument.hidden
                }]);
            } catch (err) {
                console.error(`${MODULE_ID} | Failed to auto-add token to combat:`, err);
            }
        });
    } catch (err) {
        console.error(`${MODULE_ID} | Error in createToken hook for Auto-Add Tokens to Combat:`, err);
    }
}

/**
 * Whether an add-on wants this token left out (e.g. dnd5e summons, which get their own handling).
 * @param {TokenDocument} tokenDocument
 * @returns {boolean}
 */
function _isSkippedToken(tokenDocument) {
    return getExtensions("autoAddTokensToCombat").some(ext => {
        try {
            return (typeof ext.skipToken === "function") && Boolean(ext.skipToken(tokenDocument));
        } catch (err) {
            debug("Auto-Add Tokens to Combat: extension skipToken failed", err);
            return false;
        }
    });
}

