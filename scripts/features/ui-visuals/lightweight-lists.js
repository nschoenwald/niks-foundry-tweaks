/**
 * Feature: Lightweight Chat & Sidebar Lists
 * Description: Lets the browser skip layout and painting of chat messages and sidebar directory entries that are
 * scrolled out of view (CSS `content-visibility: auto`), so long chat logs and large directories stay responsive.
 *
 * @introduced v14.2.0
 */
import { MODULE_ID, isFeatureActive, clearSettingsCache, log } from "../../context.js";

const BODY_CLASS = "nft-lightweight-lists";

/**
 * Adds or removes the body class that enables the stylesheet rules, following the world and personal settings.
 * Called from the settings' onChange too, which can run before the settings cache is cleared by its hooks.
 */
export function updateLightweightLists() {
    clearSettingsCache(`${MODULE_ID}.enableLightweightLists`);
    clearSettingsCache(`${MODULE_ID}.clientEnableLightweightLists`);
    const active = isFeatureActive("enableLightweightLists", "clientEnableLightweightLists");
    document.body.classList.toggle(BODY_CLASS, active);
    log(`Lightweight Chat & Sidebar Lists ${active ? "enabled" : "disabled"}`);
}
