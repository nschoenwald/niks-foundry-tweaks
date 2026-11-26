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
 * - `teleportTargeting`: `{ getTeleportInfo?: ({ sourceToken, source }) => { range?: number|null, itemName?: string } | null }`
 *   (range in scene units for teleports whose module doesn't tell it, e.g. BLFX; API_VERSION 3)
 *
 * Setting entries of a schema can use `list: true` with `choicePicker: { getGroups, mode?, normalize?, noun?, resetTitle? }`
 * to pick entries from known options (API_VERSION 2, see `settings-choice-picker.js`).
 *
 * The dashboard shows one row per feature: a top-level setting, with its `parentKey` children and the personal
 * (client) settings linked to it by `pairedWith` folded underneath. A personal setting with neither a world setting
 * nor a personal parent is a feature of its own; `homeTab: "<tab id>"` names the tab it is listed in (default: the
 * first tab) (API_VERSION 5).
 *
 * `teleportTargeting.isActive()` / `teleportTargeting.pickDestination({ sourceToken, itemName?, range?, checkCollision?,
 * customImg?, customImgScale? })`: the teleport HUD and ghost preview as a destination picker. Resolves
 * `{ x, y, rotation, distance, center }`, null when cancelled, or undefined when it couldn't start (API_VERSION 3,
 * see `autoanimations-teleport-ui.js`).
 *
 * `syncCheck.check()` compares this client with the server, posts or clears the chat message and resolves
 * `{ status: "ok"|"drift"|"error", differences }`. `syncCheck.checkUsers(userIds?)` (GM) asks connected users to do
 * the same and resolves their status by user id (API_VERSION 4, see `sync-check.js`).
 *
 * Bump `API_VERSION` when something here changes in a way add-ons must know about.
 *
 * @introduced v14.0.0
 * @updated v14.7.0 (API_VERSION 2: `choicePicker` setting option)
 * @updated v14.9.0 (API_VERSION 3: `teleportTargeting` picker and extension)
 * @updated v14.17.0 (API_VERSION 4: `syncCheck`)
 * @updated v14.19.0 (API_VERSION 5: feature-first dashboard, `homeTab` setting option)
 */
import { createContext } from "./utils/create-context.js";
import { attachHudPositioning } from "./utils/hud-position-helper.js";
import {
    extend, getAllSettings, getExtensions, getModule, getTabs, registerModule, registerSettings,
    registerUnavailableWith, resolveSettingId
} from "./settings-registry.js";
import { NiksTweaksSettingsApp } from "./settings-app.js";
import { isTeleportTargetingActive, pickTeleportDestination } from "./features/canvas-tokens/autoanimations-teleport-ui.js";
import { checkSync, requestSyncCheck } from "./features/utilities/sync-check.js";

/** Version of the add-on contract. */
export const API_VERSION = 5;

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
        attachHudPositioning,
        // Teleport destination picker (Enhanced Teleport Targeting UI)
        teleportTargeting: {
            isActive: isTeleportTargetingActive,
            pickDestination: pickTeleportDestination
        },
        // Sync Check
        syncCheck: {
            check: () => checkSync(),
            checkUsers: (userIds) => requestSyncCheck(userIds)
        }
    };
}
