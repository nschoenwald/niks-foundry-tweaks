/**
 * Nik's Foundry Tweaks: entry point.
 *
 * Registers the settings, the dashboard and the public API in `init`, starts the features in `setup` / `ready`,
 * and copies settings over from Nik's DnD5e Tweaks once (see migration.js).
 *
 * Feature files import their helpers from `context.js`, never from this file.
 *
 * @introduced v14.0.0
 */

// Interface
import { initSceneNavName } from "./features/ui-visuals/scene-nav-name.js";
import { enableSidebarNameWrap, disableSidebarNameWrap } from "./features/ui-visuals/sidebar-name-wrap.js";
import { initSheetPopoutButton, disableSheetPopoutButton } from "./features/ui-visuals/sheet-popout-button.js";
import { initActorDispositionColors } from "./features/ui-visuals/actor-disposition-colors.js";
import { initToolbarLimitation, applyToolbarLimitation, resetToolbars } from "./features/ui-visuals/toolbar-limitation.js";
import { initCarolingianHarmony, updateCarolingianThemeState } from "./features/ui-visuals/carolingian-harmony.js";
import { updateReadableTextSize } from "./features/ui-visuals/readable-text-size.js";
import { initCleanSheetTitles } from "./features/ui-visuals/clean-sheet-titles.js";
import { initContextMenuStyling } from "./features/ui-visuals/context-menu-styling.js";
import { initHidePrivateGMRolls } from "./features/ui-visuals/hide-private-gm-rolls.js";
import { initChatScrollFix, enableChatScrollFix, disableChatScrollFix } from "./features/ui-visuals/chat-scroll-fix.js";
import { updateLightweightLists } from "./features/ui-visuals/lightweight-lists.js";
import { updateBatchedSidebarUpdates } from "./features/ui-visuals/batched-sidebar-updates.js";

// Canvas and combat
import { initClearTargets, onClearTargetsSocket } from "./features/canvas-tokens/clear-targets.js";
import { initDisableUndergroundTokenHiding } from "./features/canvas-tokens/disable-underground-token-hiding.js";
import { initAutoanimationsTeleportUI } from "./features/canvas-tokens/autoanimations-teleport-ui.js";
import { initAutoAddTokensToCombat } from "./features/combat/auto-add-tokens-to-combat.js";
import { updateIdleFrameRate } from "./features/canvas-tokens/idle-frame-rate.js";
import { updateVisionUpdateThrottle } from "./features/canvas-tokens/vision-update-throttle.js";
import { initVideoOptimization, updateVideoOptimization } from "./features/canvas-tokens/video-optimization.js";

// Utilities and patches
import { initAutoUnpauseOnLogin } from "./features/utilities/auto-unpause-on-login.js";
import { initFixTokenBarRefresh } from "./features/patches/fix-token-bar-refresh.js";
import { initFixPlaceablesSidebarTab } from "./features/patches/fix-placeables-sidebar-tab.js";
import { initFixMacBatchBuffer } from "./features/patches/fix-mac-batch-buffer.js";

// Dashboard, API, migration
import { MODULE_ID, log, isFeatureActive } from "./context.js";
import { OVERRIDE_CHOICES } from "./utils/personal-override.js";
import { NiksTweaksSettingsApp, refreshSettingsMenuBadge } from "./settings-app.js";
import { registerModule, registerSettings } from "./settings-registry.js";
import { getSettingsSchema } from "./settings-schema.js";
import { createApi } from "./api.js";
import { SOURCE_MODULE_ID, migrateClientSettings, migrateWorldSettings, migratePerformanceOptOuts } from "./migration.js";

export { MODULE_ID };

/** First Nik's DnD5e Tweaks version that leaves these features to this module. */
const ADDON_SPLIT_VERSION = "14.70.0";

/**
 * Whether an older Nik's DnD5e Tweaks is active that still runs these features itself. Core then stays out of the
 * way (no features, no migration) until it is updated, so nothing runs twice.
 * @returns {boolean}
 */
function isOutdatedAddonActive() {
    const addon = game.modules.get(SOURCE_MODULE_ID);
    return Boolean(addon?.active) && foundry.utils.isNewerVersion(ADDON_SPLIT_VERSION, addon.version);
}

Hooks.once("init", () => {

    // ==========================================
    // Settings Dashboard
    // ==========================================

    game.settings.registerMenu(MODULE_ID, "settingsDashboard", {
        name: "Nik's Tweaks Configuration",
        label: "Configure Module",
        hint: "Open the settings dashboard of Nik's Tweaks modules, with categorized tabs, search, and backup options.",
        icon: "fa-solid fa-sliders",
        type: NiksTweaksSettingsApp,
        restricted: false
    });

    // Dashboard view state: the version of each module this user last opened it in ("New" badges) and the
    // description length.
    game.settings.register(MODULE_ID, "dashboardLastSeen", {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "dashboardFullHints", {
        scope: "client",
        config: false,
        type: Boolean,
        default: false
    });

    // Migration state (see migration.js)
    game.settings.register(MODULE_ID, "migrationVersion", {
        scope: "world",
        config: false,
        type: Number,
        default: 0
    });

    game.settings.register(MODULE_ID, "clientMigrationVersion", {
        scope: "client",
        config: false,
        type: Number,
        default: 0
    });

    // "N new" on the dashboard buttons in Configure Settings
    Hooks.on("renderSettingsConfig", (app, element) => refreshSettingsMenuBadge(element));

    // ==========================================
    // Personal (client) settings
    // ==========================================

    game.settings.register(MODULE_ID, "clientEnableSceneNavName", {
        name: "Sync Browser Tab Title (Personal)",
        hint: "Syncs your browser tab title with the viewed scene name (if enabled by the GM).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: () => {
            Hooks.callAll("nft.updateTabTitle");
        }
    });

    game.settings.register(MODULE_ID, "clientEnableSheetPopoutButton", {
        name: "Sheet Pop-out Button (Personal)",
        hint: "Shows the ↗ pop-out button on character and item sheet headers (if enabled by the GM).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: (value) => {
            if (value && game.settings.get(MODULE_ID, "enableSheetPopoutButton")) initSheetPopoutButton();
            else disableSheetPopoutButton();
        }
    });

    game.settings.register(MODULE_ID, "clientEnableContextMenuStyling", {
        name: "Context Menu Styling (Personal)",
        hint: "Color-codes destructive (Delete in red), additive (Duplicate in green), and privacy actions (Make Private / Reveal in violet) in right-click context menus (if enabled by the GM).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "clientEnableAutoanimationsTeleportUI", {
        name: "Enhanced Teleport Targeting UI (Personal)",
        hint: "Enables the floating destination HUD, ghost token preview, and ESC cancellation for Automated Animations teleport presets (if enabled by the GM).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "clientEnableClearTargetsButton", {
        name: "Clear Targets Token Control Button (Personal)",
        hint: "Shows the Clear Targets button in your Token Controls toolbar (if enabled by the GM).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: () => {
            if (ui.controls) {
                if (typeof ui.controls.initialize === "function") ui.controls.initialize();
                else ui.controls.render({ reset: true });
            }
        }
    });

    game.settings.register(MODULE_ID, "clientReadableTextSize", {
        name: "Readable Text Size (Personal)",
        hint: "Overrides the GM's Readable Text Size on your screen.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: {
            world: "Use World Setting",
            off: "Off (D&D 5e Default)",
            comfortable: "Comfortable",
            large: "Large"
        },
        onChange: () => updateReadableTextSize()
    });

    game.settings.register(MODULE_ID, "clientReadableTextSizeChat", {
        name: "Readable Text Size in Chat Cards (Personal)",
        hint: "Overrides the GM's choice for enlarging descriptions in chat cards on your screen.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: {
            world: "Use World Setting",
            on: "On",
            off: "Off"
        },
        onChange: () => updateReadableTextSize()
    });

    game.settings.register(MODULE_ID, "clientLightweightLists", {
        name: "Lightweight Chat & Sidebar Lists (Personal)",
        hint: "Skips drawing chat messages and sidebar entries that are scrolled out of view on your screen. Use World Setting follows the GM.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: OVERRIDE_CHOICES,
        onChange: () => updateLightweightLists()
    });

    game.settings.register(MODULE_ID, "clientBatchedSidebarUpdates", {
        name: "Batched Sidebar Updates (Experimental, Personal)",
        hint: "Combines rapid updates of the sidebar and Combat Tracker on your screen, and updates closed sidebar tabs when you open them. Use World Setting follows the GM.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: OVERRIDE_CHOICES,
        onChange: () => updateBatchedSidebarUpdates()
    });

    game.settings.register(MODULE_ID, "clientIdleFrameRate", {
        name: "Idle Frame Rate (Personal)",
        hint: "Lowers the canvas frame rate on your screen while nobody interacts and nothing moves. Use World Setting follows the GM.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: OVERRIDE_CHOICES,
        onChange: () => updateIdleFrameRate()
    });

    game.settings.register(MODULE_ID, "idleFrameRate", {
        name: "↳ Frame Rate While Idle",
        hint: "The canvas frame rate while the game is idle.",
        scope: "client",
        config: false,
        type: String,
        default: "20",
        choices: { 10: "10 FPS", 20: "20 FPS", 30: "30 FPS" },
        onChange: () => updateIdleFrameRate()
    });

    game.settings.register(MODULE_ID, "idleFrameRateDelay", {
        name: "↳ Idle After",
        hint: "How long without activity before the frame rate drops.",
        scope: "client",
        config: false,
        type: String,
        default: "30",
        choices: { 15: "15 seconds", 30: "30 seconds", 60: "1 minute", 120: "2 minutes" },
        onChange: () => updateIdleFrameRate()
    });

    game.settings.register(MODULE_ID, "clientVisionUpdateThrottle", {
        name: "Throttled Vision Updates While Moving (Experimental, Personal)",
        hint: "Recomputes a moving token's vision and light a limited number of times per second on your screen. Use World Setting follows the GM.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: OVERRIDE_CHOICES,
        onChange: () => updateVisionUpdateThrottle()
    });

    game.settings.register(MODULE_ID, "visionUpdateRate", {
        name: "↳ Vision Updates per Second",
        hint: "How often a moving token's vision and light are recomputed.",
        scope: "client",
        config: false,
        type: String,
        default: "20",
        choices: { 30: "30 per second", 20: "20 per second", 15: "15 per second", 10: "10 per second" },
        onChange: () => updateVisionUpdateThrottle()
    });

    game.settings.register(MODULE_ID, "clientVideoOptimization", {
        name: "Lighter Video Playback (Personal)",
        hint: "Stops updating animated maps, tiles and tokens on your screen while they are out of view. Use World Setting follows the GM.",
        scope: "client",
        config: false,
        type: String,
        default: "world",
        choices: OVERRIDE_CHOICES,
        onChange: () => updateVideoOptimization()
    });

    game.settings.register(MODULE_ID, "videoFrameRateCap", {
        name: "↳ Video Frame Rate Limit",
        hint: "Shows at most this many frames per second of animated maps, tiles and tokens.",
        scope: "client",
        config: false,
        type: String,
        default: "0",
        choices: { 0: "No limit", 30: "30 FPS", 24: "24 FPS", 15: "15 FPS", 10: "10 FPS" },
        onChange: () => updateVideoOptimization()
    });

    game.settings.register(MODULE_ID, "clientEnableCarolingianTheme", {
        name: "Carolingian UI Theme Harmony (Personal)",
        hint: "Adopts Carolingian UI's active color theme and styling on your client (if enabled by the GM and Carolingian UI is active).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: () => updateCarolingianThemeState()
    });

    // ==========================================
    // World settings
    // ==========================================

    game.settings.register(MODULE_ID, "enableCarolingianTheme", {
        name: "Carolingian UI Theme Harmony",
        hint: "Harmonizes Nik's Tweaks styling with Carolingian UI, automatically adopting its active color theme (Carolingian Teal, Royal Blood, Dark Sorcery, etc.) across the settings dashboard, floating HUD banners, damage prompts, and toggles, while adjusting HUD banner positioning for top scene navigation.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: () => updateCarolingianThemeState()
    });

    game.settings.register(MODULE_ID, "enableContextMenuStyling", {
        name: "Context Menu Styling",
        hint: "Color-codes destructive (Delete in red), additive (Duplicate in green), and privacy actions (Make Private / Reveal in violet) across right-click context menus in sheets, sidebars, and chat cards, with full light and dark mode support.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableSceneNavName", {
        name: "Sync Browser Tab Title",
        hint: "Keeps the browser tab title dynamically in sync with the name of the scene the client is currently viewing.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: (value) => {
            if (value && game.settings.get(MODULE_ID, "clientEnableSceneNavName")) Hooks.callAll("nft.updateTabTitle");
            else document.title = game.world.title;
        }
    });

    game.settings.register(MODULE_ID, "enableChatScrollFix", {
        name: "Reliable Chat Log Auto-Scroll",
        hint: "Keeps the chat log pinned to the bottom during asynchronous target list resolution, CSS transitions, collapsible tray toggles, and card updates.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: (value) => {
            if (value) enableChatScrollFix();
            else disableChatScrollFix();
        }
    });

    game.settings.register(MODULE_ID, "enableHidePrivateGMRolls", {
        name: "Hide Private GM Rolls from Players",
        hint: "Completely hides whispered, private, and blind rolls made by the GM from players in the chat log, rather than displaying an empty placeholder card with hidden contents.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: () => {
            ui.chat?.render(true);
            if (ui.chat?.popout?.rendered) ui.chat.popout.render(true);
        }
    });

    game.settings.register(MODULE_ID, "enableActorDispositionColors", {
        name: "Actor Directory Disposition Dots",
        hint: "Adds a colored dot next to each actor name in the Actors sidebar to indicate their default token disposition (Friendly, Neutral, Hostile, or Secret).",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: () => {
            ui.actors.render();
        }
    });

    game.settings.register(MODULE_ID, "readableTextSize", {
        name: "Readable Text Size",
        hint: "Default size for the body text of item descriptions, biographies, journal pages, expanded items on sheets and item tooltips, with more space between lines. The rest of the interface keeps its size. Players can override it under Personal Preferences.",
        scope: "world",
        config: false,
        type: String,
        default: "comfortable",
        choices: {
            off: "Off (D&D 5e Default)",
            comfortable: "Comfortable",
            large: "Large"
        },
        restricted: true,
        onChange: () => updateReadableTextSize()
    });

    game.settings.register(MODULE_ID, "readableTextSizeChat", {
        name: "Readable Text Size in Chat Cards",
        hint: "Also enlarges item and spell descriptions inside chat cards. Cards become taller. Players can override it under Personal Preferences.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateReadableTextSize()
    });

    game.settings.register(MODULE_ID, "enableLightweightLists", {
        name: "Lightweight Chat & Sidebar Lists",
        hint: "Lets the browser skip drawing chat messages and sidebar directory entries that are scrolled out of view, so long chat logs and large directories scroll and update faster.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateLightweightLists()
    });

    game.settings.register(MODULE_ID, "enableBatchedSidebarUpdates", {
        name: "Batched Sidebar Updates (Experimental)",
        hint: "Experimental: combines rapid updates of the sidebar directories and the Combat Tracker into one redraw, updates sidebar tabs that aren't open only when you open them, and skips rebuilding the Actors and Items folder lists when only values like hit points change.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateBatchedSidebarUpdates()
    });

    game.settings.register(MODULE_ID, "enableSidebarNameWrap", {
        name: "Sidebar Multi-line Names",
        hint: "Allows long document names in the right sidebar (Actors, Items, Scenes, etc.) to wrap onto multiple lines instead of being cut off.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: (value) => {
            if (value) enableSidebarNameWrap();
            else disableSidebarNameWrap();
        }
    });

    game.settings.register(MODULE_ID, "enableCleanSheetTitles", {
        name: "Clean Sheet Window Titles",
        hint: "Removes the verbose type prefix (e.g. \"Non Player Character:\") from document sheet window titles, showing just the document name. Especially useful when detaching windows in V14, where the prefix otherwise consumes all visible space in the taskbar. Requires a reload to take effect.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        requiresReload: true
    });

    game.settings.register(MODULE_ID, "cleanSheetTitles_format", {
        name: "↳ Sheet Title Format",
        hint: "How to display document sheet window titles. \"Name Only\" shows just the name (e.g. \"Goblin\"). \"Type: Name\" adds a prefix (e.g. \"Non Player Character: Goblin\"). \"Name (Type)\" adds a suffix (e.g. \"Goblin (Non Player Character)\").",
        scope: "world",
        config: false,
        type: String,
        default: "name",
        choices: {
            name: "Name Only",
            prefix: "Type: Name",
            suffix: "Name (Type)"
        },
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableSheetPopoutButton", {
        name: "Sheet Pop-out Button",
        hint: "Adds a one-click pop-out button (↗) to the header of Actor and Item sheets, allowing you to detach the window into a separate browser window using Foundry's native pop-out functionality — without going through the three-dot menu. When the sheet is already detached, the button flips to an attach-back icon (↙) to return it to the main workspace.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: (value) => {
            if (isFeatureActive("enableSheetPopoutButton", "clientEnableSheetPopoutButton")) initSheetPopoutButton();
            else disableSheetPopoutButton();
        }
    });

    game.settings.register(MODULE_ID, "enableToolbarLimitation", {
        name: "Toolbar Limitation",
        hint: "When the number of buttons in a given scene controls toolbar exceeds a configured limit, turns the toolbar scrollable and limits the visible height to display only that number of buttons at a time (does not apply to the macro hotbar).",
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
        onChange: (value) => {
            if (value) applyToolbarLimitation();
            else resetToolbars();
            ui.controls?.render();
        }
    });

    game.settings.register(MODULE_ID, "toolbarButtonLimit", {
        name: "↳ Max Displayed Toolbar Buttons",
        hint: "The maximum number of buttons to display in a toolbar before it becomes scrollable.",
        scope: "client",
        config: false,
        type: Number,
        default: 20,
        onChange: () => {
            applyToolbarLimitation();
            ui.controls?.render();
        }
    });

    game.settings.register(MODULE_ID, "disableUndergroundTokenHiding", {
        name: "Disable Underground Token Hiding",
        hint: "Prevents tokens with negative elevation from disappearing behind the scene background. By default, Foundry renders tokens below elevation 0 behind the background layer, making them invisible. This tweak keeps them visible while preserving the actual elevation value. Requires a reload to take effect.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        requiresReload: true
    });

    game.settings.register(MODULE_ID, "enableAutoanimationsTeleportUI", {
        name: "Enhanced Teleport Targeting UI (Autoanimations)",
        hint: "When using an Automated Animations teleport preset (e.g. Misty Step, Dimension Door), adds a floating screen banner with live range/distance readout, a ghost token preview under the cursor showing valid/invalid placement, and allows pressing ESC to cancel.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableClearTargetsButton", {
        name: "Clear Targets Token Control Button",
        hint: "Adds a button to the Token Controls toolbar that removes targets. For players, it removes their own targets; for GMs, it removes targets for both themselves and all connected players.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: () => {
            if (ui.controls) {
                if (typeof ui.controls.initialize === "function") ui.controls.initialize();
                else ui.controls.render({ reset: true });
            }
        }
    });

    game.settings.register(MODULE_ID, "enableIdleFrameRate", {
        name: "Idle Frame Rate",
        hint: "Lowers the canvas frame rate while nobody interacts with the game and nothing moves, and returns to the normal frame rate on the next activity.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateIdleFrameRate()
    });

    game.settings.register(MODULE_ID, "enableVisionUpdateThrottle", {
        name: "Throttled Vision Updates While Moving (Experimental)",
        hint: "Experimental: while a token moves, recomputes its vision and light a limited number of times per second instead of every frame.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateVisionUpdateThrottle()
    });

    game.settings.register(MODULE_ID, "enableVideoOptimization", {
        name: "Lighter Video Playback",
        hint: "Animated maps, tiles and tokens stop sending new frames to the graphics card while they are off screen or hidden, and can be limited to fewer frames per second.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => updateVideoOptimization()
    });

    game.settings.register(MODULE_ID, "enableAutoAddTokensToCombat", {
        name: "Auto-Add Tokens to Combat",
        hint: "Automatically adds new tokens to the active combat encounter when created or dragged to the canvas during combat.",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "autoUnpauseOnLogin", {
        name: "Auto-Unpause When Logging In",
        hint: "When you (the GM) log into a world that is paused, automatically unpause. \"Always\" unpauses regardless of connected players. \"When no players are connected\" only unpauses if no non-GM players are already in the session. \"Never\" disables this feature. Per-GM-user setting — each GM account configures this independently.",
        scope: "user",
        config: false,
        type: String,
        default: "never",
        choices: {
            always: "Always",
            noPlayers: "When no players are connected",
            never: "Never"
        }
    });

    game.settings.register(MODULE_ID, "debugMode", {
        name: "Debug Mode",
        hint: "Enables verbose debug logging in the browser console for all module features. Useful for troubleshooting issues.",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: (value) => {
            log(`Debug mode ${value ? "enabled" : "disabled"}`);
        }
    });

    // What the dashboard shows. Core registers first, so its tabs are the base add-ons merge into.
    registerModule({
        id: MODULE_ID,
        title: "Nik's Foundry Tweaks",
        docsUrl: "https://github.com/nschoenwald/niks-foundry-tweaks#"
    });
    registerSettings(MODULE_ID, getSettingsSchema());

    // Public API, then let add-ons register (their listeners were added at the top level of their scripts)
    const api = createApi();
    const moduleData = game.modules.get(MODULE_ID);
    if (moduleData) moduleData.api = api;
    Hooks.callAll("niksTweaks.register", api);

    if (isOutdatedAddonActive()) {
        log(`Nik's DnD5e Tweaks older than ${ADDON_SPLIT_VERSION} is active and still runs these features. Core features stay off until it is updated.`);
        return;
    }

    // Personal settings stored by Nik's DnD5e Tweaks, before any feature reads them
    migrateClientSettings();
    migratePerformanceOptOuts();

    // Features that need to catch early hooks (scene controls, canvas object classes)
    initDisableUndergroundTokenHiding();
    initToolbarLimitation();
});

Hooks.once("setup", () => {
    if (isOutdatedAddonActive()) return;

    // Interface
    initSceneNavName();
    initActorDispositionColors();
    initCleanSheetTitles();
    initSheetPopoutButton();
    initContextMenuStyling();
    initCarolingianHarmony();
    initChatScrollFix();
    initHidePrivateGMRolls();
    updateLightweightLists();
    updateBatchedSidebarUpdates();

    // Canvas and combat
    initAutoAddTokensToCombat();
    initAutoanimationsTeleportUI();
    initClearTargets();
    updateIdleFrameRate();
    updateVisionUpdateThrottle();
    initVideoOptimization();

    // Utilities and fixes
    initAutoUnpauseOnLogin();
    initFixTokenBarRefresh();
    initFixPlaceablesSidebarTab();
    initFixMacBatchBuffer();
});

Hooks.once("ready", async () => {
    if (isOutdatedAddonActive()) {
        if (game.user.isGM) {
            ui.notifications.warn(`Nik's Foundry Tweaks: please update Nik's DnD5e Tweaks to ${ADDON_SPLIT_VERSION} or later. Until then, its features stay in Nik's DnD5e Tweaks and Nik's Foundry Tweaks does nothing.`, { permanent: true });
        }
        return;
    }

    // World settings stored by Nik's DnD5e Tweaks (active GM only, so two connected GMs never run it at once)
    if (game.user.isActiveGM) await migrateWorldSettings();

    if (game.settings.get(MODULE_ID, "enableSidebarNameWrap")) enableSidebarNameWrap();
    updateReadableTextSize();

    // One socket listener for the whole module, routing by action
    game.socket.on(`module.${MODULE_ID}`, (data) => {
        if (data?.action === "clearTargets") onClearTargetsSocket(data);
    });
});
