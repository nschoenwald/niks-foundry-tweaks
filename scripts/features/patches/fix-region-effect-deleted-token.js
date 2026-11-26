/**
 * Feature: Region Effects on Deleted Tokens Patch
 * Description: Deleting an unlinked token that stands in a region with an "Apply Active Effect" behavior no longer
 * shows a "does not exist" error.
 *
 * @introduced v14.21.0
 * @updated niks-dnd5e-tweaks v14.115.4 (first shipped there for core's and D&D 5e's behavior)
 */
import { MODULE_ID, log } from "../../context.js";

/**
 * Fix: Effect Removal on Deleted Unlinked Tokens
 * ---------------------------------------------------------------------------
 * Foundry V14 fires TOKEN_EXIT for every region a token stood in when the token is deleted
 * (`TokenDocument._onDeleteOperation`, after the server already deleted it and after the token left
 * `scene.tokens`). Core's `ApplyActiveEffectRegionBehaviorType#onTokenExit` then deletes its effect from
 * `token.actor`. For an unlinked token that actor is synthetic: the deletion goes through the deleted token's
 * ActorDelta, the server can't find the token and answers "undefined id [<token id>] does not exist in the
 * EmbeddedCollection collection", shown as an error toast. Seen with Foundry 14.370; not fixed upstream yet, so not
 * version-gated.
 *
 * The exit handler is skipped for an unlinked token that is no longer in its scene: its effects went with it.
 * Linked tokens keep the handler, because the world actor still carries the effect and it must be removed.
 * The handler lives in the behavior type's static `events` object (dispatched by `RegionBehavior#_handleRegionEvent`
 * through `system.constructor.events[name]`), so that entry is wrapped. Systems with their own copy of the behavior
 * patch it in their add-on (niks-dnd5e-tweaks: `dnd5e.applyActiveEffect`).
 */
const PATCHED = Symbol(`${MODULE_ID}.deletedTokenExit`);

/**
 * Whether a region event is the exit of an unlinked token that was deleted.
 * @param {RegionEvent} event
 * @returns {boolean}
 */
function _isDeletedUnlinkedToken(event) {
    const token = event?.data?.token;
    return !!token && !token.actorLink && !!token.parent && !token.parent.tokens?.has(token.id);
}

export function initFixRegionEffectDeletedToken() {
    const events = CONFIG.RegionBehavior?.dataModels?.applyActiveEffect?.events;
    const exit = CONST.REGION_EVENTS.TOKEN_EXIT;
    const original = events?.[exit];
    if ((typeof original !== "function") || original[PATCHED]) return;
    const wrapped = async function(event) {
        if (_isDeletedUnlinkedToken(event)) return;
        return original.call(this, event);
    };
    wrapped[PATCHED] = true;
    events[exit] = wrapped;
    log("Fix: Region Effects on Deleted Tokens | Patched the Apply Active Effect behavior.");
}
