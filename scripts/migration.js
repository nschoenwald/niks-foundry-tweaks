/**
 * Settings migration from Nik's DnD5e Tweaks
 * ------------------------------------------
 * The features in this module used to live in Nik's DnD5e Tweaks, with their settings stored under the
 * `niks-dnd5e-tweaks` namespace. These functions copy the stored values to `niks-foundry-tweaks` once, so nobody
 * loses their configuration. Unregistered settings can still be read from storage, so this works whether or not
 * Nik's DnD5e Tweaks is installed or active.
 *
 * - Values are copied as stored (raw JSON strings), so types are kept exactly.
 * - A value is only copied when this module has none stored yet.
 * - The old values are left in place, so going back to an older Nik's DnD5e Tweaks still works.
 *
 * @introduced v14.0.0
 */
import { MODULE_ID, log } from "./context.js";

/** The module the settings come from. */
export const SOURCE_MODULE_ID = "niks-dnd5e-tweaks";

/** Settings that moved from Nik's DnD5e Tweaks (same key in both modules). Scope is read from the registration. */
export const MIGRATED_KEYS = Object.freeze([
    // Interface
    "enableSceneNavName", "clientEnableSceneNavName",
    "enableSidebarNameWrap",
    "enableSheetPopoutButton", "clientEnableSheetPopoutButton",
    "enableActorDispositionColors",
    "enableToolbarLimitation", "toolbarButtonLimit",
    "enableCarolingianTheme", "clientEnableCarolingianTheme",
    "readableTextSize", "readableTextSizeChat", "clientReadableTextSize", "clientReadableTextSizeChat",
    "enableCleanSheetTitles", "cleanSheetTitles_format",
    "enableContextMenuStyling", "clientEnableContextMenuStyling",
    "enableHidePrivateGMRolls",
    "enableChatScrollFix",
    // Canvas and combat
    "enableClearTargetsButton", "clientEnableClearTargetsButton",
    "disableUndergroundTokenHiding",
    "enableAutoanimationsTeleportUI", "clientEnableAutoanimationsTeleportUI",
    "enableAutoAddTokensToCombat",
    // Utilities
    "autoUnpauseOnLogin",
    "debugMode",
    // Dashboard view state
    "dashboardFullHints"
]);

/** Current migration version (world: `migrationVersion`, client: `clientMigrationVersion`). */
const MIGRATION_VERSION = 1;

/**
 * Copy client-scoped settings from this browser's storage. Runs on every client during `init`, after the settings
 * are registered and before any feature reads them.
 */
export function migrateClientSettings() {
    const store = game.settings.storage.get("client");
    const flagId = `${MODULE_ID}.clientMigrationVersion`;
    if (Number(store.getItem(flagId) ?? 0) >= MIGRATION_VERSION) return;

    let copied = 0;
    for (const key of MIGRATED_KEYS) {
        const config = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (config?.scope !== "client") continue;
        const source = store.getItem(`${SOURCE_MODULE_ID}.${key}`);
        const targetId = `${MODULE_ID}.${key}`;
        if ((source === null) || (store.getItem(targetId) !== null)) continue;
        store.setItem(targetId, source);
        copied++;
    }

    // "New" badges: keep what this user had seen of Nik's DnD5e Tweaks, and count the moved settings as seen.
    const seenId = `${MODULE_ID}.dashboardLastSeen`;
    if (store.getItem(seenId) === null) {
        const seen = _readSourceLastSeen(store);
        if (Object.keys(seen).length) {
            seen[MODULE_ID] = game.modules.get(MODULE_ID)?.version ?? "";
            store.setItem(seenId, JSON.stringify(seen));
        }
    }

    store.setItem(flagId, JSON.stringify(MIGRATION_VERSION));
    if (copied) log(`Copied ${copied} personal setting(s) from Nik's DnD5e Tweaks.`);
}

/** Personal opt-outs of the 14.2.0 performance features (Boolean) and the override settings replacing them in 14.2.2. */
const PERFORMANCE_OPT_OUTS = Object.freeze({
    clientEnableLightweightLists: "clientLightweightLists",
    clientEnableBatchedSidebarUpdates: "clientBatchedSidebarUpdates",
    clientEnableIdleFrameRate: "clientIdleFrameRate",
    clientEnableVisionUpdateThrottle: "clientVisionUpdateThrottle",
    clientEnableVideoOptimization: "clientVideoOptimization"
});

/**
 * Converts the personal opt-outs of 14.2.0 / 14.2.1 into the personal overrides of 14.2.2: a player who had turned a
 * feature off keeps it off ("off"); everyone else follows the world setting ("world", the default, nothing stored).
 * Removes the old keys afterwards, so it runs only once per browser. Runs during `init`, before features read them.
 *
 * @introduced v14.2.2
 */
export function migratePerformanceOptOuts() {
    const store = game.settings.storage.get("client");
    let converted = 0;
    for (const [oldKey, newKey] of Object.entries(PERFORMANCE_OPT_OUTS)) {
        const oldId = `${MODULE_ID}.${oldKey}`;
        const raw = store.getItem(oldId);
        if (raw === null) continue;
        const newId = `${MODULE_ID}.${newKey}`;
        let wasOff = false;
        try {
            wasOff = JSON.parse(raw) === false;
        } catch {
            wasOff = raw === "false";
        }
        if (wasOff && (store.getItem(newId) === null)) {
            store.setItem(newId, JSON.stringify("off"));
            converted++;
        }
        store.removeItem(oldId);
    }
    if (converted) log(`Kept ${converted} performance feature(s) turned off on this screen (personal settings changed to Use World Setting / On / Off).`);
}

/**
 * Versions this user last saw in Nik's DnD5e Tweaks' dashboard: its per-module object (14.69.0) or the single
 * version it stored before.
 * @param {Storage} store
 * @returns {Record<string, string>}
 */
function _readSourceLastSeen(store) {
    try {
        const object = JSON.parse(store.getItem(`${SOURCE_MODULE_ID}.dashboardLastSeen`) ?? "null");
        if (object && (typeof object === "object") && Object.keys(object).length) return { ...object };
        const legacy = JSON.parse(store.getItem(`${SOURCE_MODULE_ID}.dashboardLastSeenVersion`) ?? "null");
        if (legacy && (typeof legacy === "string")) return { [SOURCE_MODULE_ID]: legacy };
    } catch {
        // Unreadable values: start fresh
    }
    return {};
}

/**
 * Copy world- and user-scoped settings. Runs once per world, on the active GM, during `ready`.
 */
export async function migrateWorldSettings() {
    if ((game.settings.get(MODULE_ID, "migrationVersion") ?? 0) >= MIGRATION_VERSION) return;

    const storage = game.settings.storage.get("world");
    const toCreate = [];
    for (const key of MIGRATED_KEYS) {
        const config = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!config || (config.scope === "client")) continue;
        const sourceId = `${SOURCE_MODULE_ID}.${key}`;
        const targetId = `${MODULE_ID}.${key}`;
        const users = config.scope === "user" ? game.users.map(u => u.id) : [null];
        for (const user of users) {
            const source = storage.getSetting(sourceId, user);
            if (!source || storage.getSetting(targetId, user)) continue;
            toCreate.push({ key: targetId, user, value: source._source.value });
        }
    }

    if (toCreate.length) {
        await CONFIG.Setting.documentClass.createDocuments(toCreate);
        log(`Copied ${toCreate.length} world and user setting(s) from Nik's DnD5e Tweaks.`);
    }
    await game.settings.set(MODULE_ID, "migrationVersion", MIGRATION_VERSION);
}

/**
 * Route keys of a Nik's DnD5e Tweaks settings export that moved to this module (dashboard import of older files).
 * @param {Record<string, Record<string, any>>} modules  Settings by module id.
 * @returns {Record<string, Record<string, any>>}
 */
export function routeMovedSettings(modules) {
    const source = modules[SOURCE_MODULE_ID];
    if (!source) return modules;
    const routed = { ...modules, [SOURCE_MODULE_ID]: {}, [MODULE_ID]: { ...(modules[MODULE_ID] ?? {}) } };
    const moved = new Set(MIGRATED_KEYS);
    for (const [key, value] of Object.entries(source)) {
        // A value for core in the same file wins over the copy still listed under the add-on
        if (moved.has(key)) routed[MODULE_ID][key] ??= value;
        else routed[SOURCE_MODULE_ID][key] = value;
    }
    return routed;
}
