/**
 * Dashboard schema of Nik's Foundry Tweaks: tabs → sections → settings.
 *
 * Registered in `main.js` (`registerSettings(MODULE_ID, …)`). Core registers first, so its tab and section ids,
 * labels and order are the base that add-ons merge into: add-ons reuse these ids to put their settings in the same
 * places (e.g. "personalPreferences", "uiVisuals", "canvasTokens", "combatFlow", "utilities").
 *
 * Entry metadata as in the add-ons: `introduced`, `pairedWith`, `docs`, `keywords`, `parentKey`, `unavailableWith`,
 * `requiresModule`, `condition`, `list`, `statusPicker`.
 *
 * @introduced v14.0.0
 */
import { getExtensions } from "./settings-registry.js";

/**
 * Readable Text Size in chat cards needs an add-on that styles its system's chat cards.
 * @returns {boolean}
 */
const readableTextChatSupported = () => getExtensions("readableTextSize").some(ext => ext.chat);

/**
 * @returns {object[]} The tabs of this module's dashboard schema.
 */
export function getSettingsSchema() {
    return [
        {
            id: "personalPreferences",
            order: 0,
            label: "Personal Preferences",
            icon: "fa-solid fa-user-gear",
            description: "Settings for your own screen only. Turn features on or off for yourself without affecting other players or the GM.",
            sections: [
                {
                    id: "clientVisuals",
                    title: "Interface & Visual Enhancements",
                    icon: "fa-solid fa-wand-magic-sparkles",
                    settings: [
                        {
                            key: "clientEnableCarolingianTheme",
                            introduced: "14.0.0",
                            pairedWith: "enableCarolingianTheme",
                            name: "Carolingian UI Theme Harmony",
                            hint: "Automatically adopts Carolingian UI's active color theme and styling across the dashboard, floating HUD banners, damage prompts, and combat placeholders (only active when Carolingian UI is enabled).",
                            type: "Boolean",
                            default: true,
                            scope: "client",
                            requiresModule: "crlngn-ui"
                        },
                        {
                            key: "clientReadableTextSize",
                            introduced: "14.0.0",
                            pairedWith: "readableTextSize",
                            name: "Readable Text Size",
                            hint: "Overrides the GM's Readable Text Size on your screen: larger body text with more space between lines in journal pages and, with a system add-on such as Nik's DnD5e Tweaks, descriptions on sheets and in tooltips.",
                            type: "Select",
                            default: "world",
                            choices: [
                                { value: "world", label: "Use World Setting" },
                                { value: "off", label: "Off (System Default)" },
                                { value: "comfortable", label: "Comfortable" },
                                { value: "large", label: "Large" }
                            ],
                            scope: "client"
                        },
                        {
                            key: "clientReadableTextSizeChat",
                            introduced: "14.0.0",
                            pairedWith: "readableTextSizeChat",
                            name: "Readable Text Size in Chat Cards",
                            hint: "Overrides the GM's choice for enlarging item and spell descriptions inside chat cards on your screen.",
                            condition: readableTextChatSupported,
                            type: "Select",
                            default: "world",
                            choices: [
                                { value: "world", label: "Use World Setting" },
                                { value: "on", label: "On" },
                                { value: "off", label: "Off" }
                            ],
                            scope: "client"
                        },
                        {
                            key: "clientEnableSceneNavName",
                            introduced: "14.0.0",
                            pairedWith: "enableSceneNavName",
                            name: "Sync Browser Tab Title",
                            hint: "Syncs your browser tab title with the viewed scene name (if enabled by the GM).",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        },
                        {
                            key: "clientEnableSheetPopoutButton",
                            introduced: "14.0.0",
                            pairedWith: "enableSheetPopoutButton",
                            name: "Sheet Pop-out Button",
                            hint: "Shows the ↗ pop-out button on character and item sheet headers (if enabled by the GM).",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        },
                        {
                            key: "clientEnableContextMenuStyling",
                            introduced: "14.0.0",
                            pairedWith: "enableContextMenuStyling",
                            name: "Context Menu Styling",
                            hint: "Color-codes destructive (Delete in red), additive (Duplicate in green), and privacy actions (Make Private / Reveal in violet) in right-click context menus (if enabled by the GM).",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        },
                        {
                            key: "enableToolbarLimitation",
                            introduced: "14.0.0",
                            docs: "toolbar-limitation",
                            keywords: ["scene controls", "scroll"],
                            name: "Toolbar Limitation",
                            hint: "When the number of buttons in a scene controls toolbar exceeds the limit, turns the toolbar scrollable.",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        },
                        {
                            key: "toolbarButtonLimit",
                            introduced: "14.0.0",
                            name: "Max Displayed Toolbar Buttons",
                            hint: "The maximum number of buttons to display in a toolbar before scrolling.",
                            type: "Number",
                            default: 20,
                            scope: "client",
                            parentKey: "enableToolbarLimitation"
                        }
                    ]
                },
                {
                    id: "clientCanvas",
                    title: "Canvas & Templates",
                    icon: "fa-solid fa-shapes",
                    settings: [
                        {
                            key: "clientEnableAutoanimationsTeleportUI",
                            introduced: "14.0.0",
                            pairedWith: "enableAutoanimationsTeleportUI",
                            name: "Enhanced Teleport Targeting UI",
                            hint: "Shows a floating HUD banner, ghost token preview, and allows pressing ESC to cancel when picking an Automated Animations teleport destination (if enabled by the GM).",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        },
                        {
                            key: "clientEnableClearTargetsButton",
                            introduced: "14.0.0",
                            pairedWith: "enableClearTargetsButton",
                            name: "Clear Targets Token Control Button",
                            hint: "Shows the Clear Targets button in your Token Controls toolbar (if enabled by the GM).",
                            type: "Boolean",
                            default: true,
                            scope: "client"
                        }
                    ]
                }
            ]
        },
        {
            id: "uiVisuals",
            order: 10,
            label: "UI & Visuals",
            icon: "fa-solid fa-palette",
            description: "The interface: sidebar, sheets, windows and the chat log.",
            sections: [
                {
                    id: "uiGeneral",
                    title: "General Interface",
                    icon: "fa-solid fa-desktop",
                    settings: [
                        {
                            key: "enableSceneNavName",
                            introduced: "14.0.0",
                            docs: "sync-browser-tab-title",
                            keywords: ["browser title"],
                            name: "Sync Browser Tab Title",
                            hint: "Keeps the browser tab title dynamically in sync with the name of the scene the client is currently viewing.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "enableActorDispositionColors",
                            introduced: "14.0.0",
                            docs: "actor-directory-disposition-dots",
                            keywords: ["friendly", "hostile", "neutral", "sidebar"],
                            name: "Actor Directory Disposition Dots",
                            hint: "Adds a colored dot next to each actor name in the Actors sidebar to indicate their default token disposition (Friendly, Neutral, Hostile, or Secret).",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "readableTextSize",
                            introduced: "14.0.0",
                            docs: "readable-text-size",
                            keywords: ["font size", "accessibility", "bigger text", "line height"],
                            name: "Readable Text Size",
                            hint: "Default size for the body text of journal pages, with more space between lines. System add-ons such as Nik's DnD5e Tweaks apply it to descriptions on sheets and in tooltips too. The rest of the interface keeps its size. Players can override it under Personal Preferences.",
                            type: "Select",
                            default: "comfortable",
                            choices: [
                                { value: "off", label: "Off (System Default)" },
                                { value: "comfortable", label: "Comfortable" },
                                { value: "large", label: "Large" }
                            ],
                            scope: "world"
                        },
                        {
                            key: "readableTextSizeChat",
                            introduced: "14.0.0",
                            docs: "readable-text-size",
                            name: "Readable Text Size in Chat Cards",
                            hint: "Also enlarges item and spell descriptions inside chat cards. Cards become taller. Players can override it under Personal Preferences.",
                            condition: readableTextChatSupported,
                            type: "Boolean",
                            default: false,
                            scope: "world"
                        },
                        {
                            key: "enableSidebarNameWrap",
                            introduced: "14.0.0",
                            docs: "sidebar-multi-line-names",
                            keywords: ["long names", "sidebar"],
                            name: "Sidebar Multi-line Names",
                            hint: "Allows long document names in the right sidebar (Actors, Items, Scenes, etc.) to wrap onto multiple lines instead of being cut off.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "enableContextMenuStyling",
                            introduced: "14.0.0",
                            docs: "context-menu-styling",
                            keywords: ["right-click", "delete"],
                            name: "Context Menu Styling",
                            hint: "Color-codes destructive (Delete in red), additive (Duplicate in green), and privacy actions (Make Private / Reveal in violet) across right-click context menus in sheets, sidebars, and chat cards, with full light and dark mode support.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "enableCarolingianTheme",
                            introduced: "14.0.0",
                            docs: "carolingian-ui-theme-harmony",
                            name: "Carolingian UI Theme Harmony",
                            hint: "Harmonizes Nik's Tweaks styling with Carolingian UI, automatically adopting its active color theme (Carolingian Teal, Royal Blood, Dark Sorcery, etc.) across the settings dashboard, floating HUD banners, damage prompts, and toggles, while adjusting HUD banner positioning for top scene navigation.",
                            type: "Boolean",
                            default: true,
                            scope: "world",
                            requiresModule: "crlngn-ui"
                        }
                    ]
                },
                {
                    id: "uiSheets",
                    title: "Sheets & Items",
                    icon: "fa-solid fa-file-lines",
                    settings: [
                        {
                            key: "enableCleanSheetTitles",
                            introduced: "14.0.0",
                            docs: "clean-sheet-window-titles",
                            keywords: ["window title"],
                            name: "Clean Sheet Window Titles",
                            hint: "Removes the verbose type prefix (e.g. \"Non Player Character:\") from document sheet window titles, showing just the document name.",
                            type: "Boolean",
                            default: true,
                            scope: "world",
                            requiresReload: true
                        },
                        {
                            key: "cleanSheetTitles_format",
                            introduced: "14.0.0",
                            name: "Sheet Title Format",
                            hint: "How to display document sheet window titles. \"Name Only\" shows just the name (e.g. \"Goblin\"). \"Type: Name\" adds a prefix (e.g. \"Non Player Character: Goblin\"). \"Name (Type)\" adds a suffix (e.g. \"Goblin (Non Player Character)\").",
                            type: "Select",
                            default: "name",
                            choices: [
                                { value: "name", label: "Name Only" },
                                { value: "prefix", label: "Type: Name" },
                                { value: "suffix", label: "Name (Type)" }
                            ],
                            scope: "world",
                            parentKey: "enableCleanSheetTitles"
                        },
                        {
                            key: "enableSheetPopoutButton",
                            introduced: "14.0.0",
                            docs: "sheet-pop-out-button",
                            name: "Sheet Pop-out Button",
                            hint: "Adds a one-click pop-out button (↗) to the header of Actor and Item sheets to detach into a separate window without the 3-dot menu.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        }
                    ]
                },
                {
                    id: "chatLog",
                    title: "Chat Log",
                    icon: "fa-solid fa-comments",
                    settings: [
                        {
                            key: "enableChatScrollFix",
                            introduced: "14.0.0",
                            docs: "reliable-chat-log-auto-scroll",
                            keywords: ["scroll", "chat log"],
                            name: "Reliable Chat Log Auto-Scroll",
                            hint: "Fixes the chat log failing to scroll completely to the bottom when new cards appear or expand. Keeps the chat log pinned during CSS transitions, asynchronous target resolution, collapsible tray toggles, and card updates.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "enableHidePrivateGMRolls",
                            introduced: "14.0.0",
                            docs: "hide-private-gm-rolls-from-players",
                            keywords: ["whisper", "blind roll", "secret roll"],
                            name: "Hide Private GM Rolls from Players",
                            hint: "Completely hides whispered, private, and blind rolls made by the GM from players in the chat log, rather than displaying an empty placeholder card with hidden contents.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        }
                    ]
                }
            ]
        },
        {
            id: "canvasTokens",
            order: 20,
            label: "Canvas & Tokens",
            icon: "fa-solid fa-map",
            description: "Tokens, targeting and placing things on the canvas.",
            sections: [
                {
                    id: "tokens",
                    title: "Tokens & Token HUD",
                    icon: "fa-solid fa-chess-knight",
                    settings: [
                        {
                            key: "enableClearTargetsButton",
                            introduced: "14.0.0",
                            docs: "clear-targets-token-control-button",
                            keywords: ["untarget", "deselect"],
                            name: "Clear Targets Token Control Button",
                            hint: "Adds a button to the Token Controls toolbar that removes targets. For players, it removes their own targets; for GMs, it removes targets for both themselves and all connected players.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        },
                        {
                            key: "disableUndergroundTokenHiding",
                            introduced: "14.0.0",
                            docs: "disable-underground-token-hiding",
                            keywords: ["elevation", "burrow"],
                            name: "Disable Underground Token Hiding",
                            hint: "Prevents tokens with negative elevation from disappearing behind the scene background layer.",
                            type: "Boolean",
                            default: false,
                            scope: "world",
                            requiresReload: true
                        }
                    ]
                },
                {
                    id: "templates",
                    title: "Templates & Placement",
                    icon: "fa-solid fa-shapes",
                    settings: [
                        {
                            key: "enableAutoanimationsTeleportUI",
                            introduced: "14.0.0",
                            docs: "enhanced-teleport-targeting-ui-automated-animations",
                            keywords: ["Misty Step", "Dimension Door", "teleport", "Automated Animations"],
                            name: "Enhanced Teleport Targeting UI (Autoanimations)",
                            hint: "When using an Automated Animations teleport preset (e.g. Misty Step, Dimension Door), adds a floating screen banner with live range/distance readout, a ghost token preview under the cursor showing valid/invalid placement, and allows pressing ESC to cancel.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        }
                    ]
                }
            ]
        },
        {
            id: "combatFlow",
            order: 30,
            label: "Combat Flow",
            icon: "fa-solid fa-flag-checkered",
            description: "Running combat encounters.",
            sections: [
                {
                    id: "combatSetup",
                    title: "Combat Setup",
                    icon: "fa-solid fa-flag-checkered",
                    settings: [
                        {
                            key: "enableAutoAddTokensToCombat",
                            introduced: "14.0.0",
                            docs: "auto-add-tokens-to-combat",
                            keywords: ["combat tracker", "encounter", "reinforcements"],
                            name: "Auto-Add Tokens to Combat",
                            hint: "Automatically adds new tokens to the active combat encounter when created or dragged to the canvas during combat.",
                            type: "Boolean",
                            default: true,
                            scope: "world"
                        }
                    ]
                }
            ]
        },
        {
            id: "utilities",
            order: 100,
            label: "Utilities & Debug",
            icon: "fa-solid fa-wrench",
            description: "GM conveniences and diagnostics.",
            sections: [
                {
                    id: "gmConvenience",
                    title: "GM Convenience",
                    icon: "fa-solid fa-user-shield",
                    settings: [
                        {
                            key: "autoUnpauseOnLogin",
                            introduced: "14.0.0",
                            docs: "auto-unpause-when-logging-in",
                            keywords: ["pause", "game paused"],
                            name: "Auto-Unpause When Logging In",
                            hint: "When you (the GM) log into a paused world, automatically unpause. \"Always\" unpauses regardless of connected players. \"When no players are connected\" only unpauses if no non-GM players are already in the session.",
                            type: "Select",
                            default: "never",
                            choices: [
                                { value: "always", label: "Always" },
                                { value: "noPlayers", label: "When no players are connected" },
                                { value: "never", label: "Never" }
                            ],
                            scope: "user"
                        }
                    ]
                },
                {
                    id: "debugSection",
                    title: "Diagnostics",
                    icon: "fa-solid fa-bug",
                    settings: [
                        {
                            key: "debugMode",
                            introduced: "14.0.0",
                            docs: "debug-mode",
                            name: "Debug Mode",
                            hint: "Enables verbose debug logging in the browser console for all module features.",
                            type: "Boolean",
                            default: false,
                            scope: "world"
                        }
                    ]
                }
            ]
        }
    ];
}
