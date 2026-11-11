/**
 * Feature: Clearer Scene Control Toggles
 * Description: Makes on/off toggles in the left scene controls toolbar (e.g. "Force Snap to Grid Vertices", "Unconstrained Movement")
 * easy to tell apart. Off toggles get a neutral border and a dimmed icon, on toggles a full-strength icon, an accent
 * ring and an accent dot in the corner (no fill), and hovering no longer makes an off toggle look on. Adapts to Carolingian UI's left
 * controls and its color theme. Choice tools (Select, Draw Walls…) get the same treatment: the selected one the ring and
 * full icon without the dot, the others the dimmed icon. One-click `.button` tools are left alone. CSS only (`styles/style.css`, `body.nft-clear-scene-toggles`).
 *
 * @introduced v14.3.0
 */
import { log, isFeatureActive } from "../../context.js";

const BODY_CLASS = "nft-clear-scene-toggles";

/**
 * Adds or removes the body class from the world and personal settings.
 */
export function updateClearSceneToggles() {
    const active = isFeatureActive("enableClearSceneToggles", "clientEnableClearSceneToggles");
    document.body.classList.toggle(BODY_CLASS, active);
    log(`Clearer Scene Control Toggles ${active ? "enabled" : "disabled"}`);
}
