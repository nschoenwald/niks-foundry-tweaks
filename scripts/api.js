/**
 * Public API of Nik's Foundry Tweaks
 * ----------------------------------
 * Available as `game.modules.get("niks-foundry-tweaks").api` from `init` on, and handed to listeners of the
 * `niksTweaks.register` hook, which core calls once during its own `init`.
 *
 * System add-ons register at the top level of their main script (top-level code of every module runs before any
 * `init` hook, whatever the load order):
 *
 * ```js
 * Hooks.once("niksTweaks.register", (api) => {
 *     api.registerModule({ id: MODULE_ID, title: "Nik's DnD5e Tweaks", badge: "5e", docsUrl: "https://…#" });
 *     api.registerUnavailableWith({ midi: { label: "midi-qol", isActive: () => … } });
 *     api.registerSettings(MODULE_ID, schema);
 *     api.extend("contextMenuStyling", { deleteLabels: ["DND5E.ContextMenuActionDelete"] });
 * });
 * ```
 *
 * Settings themselves are still registered by the module that owns them (`game.settings.register`); the schema
 * only tells the dashboard how to show them.
 *
 * Feature extensions read by core (see each feature's file header):
 * - `contextMenuStyling`: `{ deleteLabels?, duplicateLabels?, violetLabels?: string[] (i18n keys), backgroundVars?: string[] }`
 * - `hidePrivateGMRolls`: `{ isRoll?: (message) => boolean }`
 * - `autoAddTokensToCombat`: `{ skipToken?: (tokenDocument) => boolean }`
 * - `carolingianHarmony`: `{ combatantClass?: (combatant) => string|null }`
 *
 * Bump `API_VERSION` when something here changes in a way add-ons must know about.
 *
 * @introduced v14.0.0
 */
import { createContext } from "./utils/create-context.js";
import { attachHudPositioning } from "./utils/hud-position-helper.js";
import {
    extend, getAllSettings, getExtensions, getModule, getTabs, registerModule, registerSettings,
    registerUnavailableWith, resolveSettingId
} from "./settings-registry.js";
import { NiksTweaksSettingsApp } from "./settings-app.js";

/** Version of the add-on contract. */
export const API_VERSION = 1;

/**
 * Build the API object.
 * @returns {object}
 */
export function createApi() {
    return {
        API_VERSION,
        // Dashboard
        registerModule,
        registerSettings,
        registerUnavailableWith,
        openSettings: (key) => NiksTweaksSettingsApp.open({ key }),
        // The dashboard class, for an add-on's own `registerMenu(…, { type: api.SettingsApp })` button
        SettingsApp: NiksTweaksSettingsApp,
        getModule,
        getTabs,
        getAllSettings,
        resolveSettingId,
        // Feature extensions
        extend,
        getExtensions,
        // Shared helpers
        createContext,
        attachHudPositioning
    };
}
