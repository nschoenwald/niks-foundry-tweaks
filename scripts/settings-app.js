import { MODULE_ID, log } from "./context.js";
import { SOURCE_MODULE_ID, routeMovedSettings } from "./migration.js";
import { NiksListEditorApp, normalizeListValue, parseListValue } from "./settings-list-editor.js";
import { NiksStatusPickerApp } from "./settings-status-picker.js";
import { NiksChoicePickerApp } from "./settings-choice-picker.js";
import { getAllSettings, getModule, getModuleIds, getTabs, getUnavailableWith, resolveSettingId } from "./settings-registry.js";

const PERSONAL_TAB = "personalPreferences";
const DASHBOARD_ID = "niks-tweaks-settings-app";

/** Section that collects a tab's personal-only features (client settings with no world setting behind them). */
const PERSONAL_SECTION = { id: "justForYou", title: "Just for You" };

/** Select values that mean a feature is switched off. */
const OFF_VALUES = new Set(["none", "off", "never"]);

/** Quick filters above the feature list. Counts are filled in live; a filter without matches is hidden. */
const FILTERS = [
    { id: "changed", label: "Changed", tooltip: "Features with an option that differs from its default" },
    { id: "new", label: "New", tooltip: "Features with something added since you last opened this dashboard" },
    { id: "off", label: "Turned Off", tooltip: "Features that are switched off" },
    { id: "reload", label: "Needs Reload", tooltip: "Features with options that take effect after reloading" },
    { id: "unavailable", label: "Handled Elsewhere", tooltip: "Features another active module takes over" }
];

/**
 * Read a dashboard entry's stored value without throwing for settings that aren't registered.
 * @param {object} setting  Registry entry (`module`, `settingKey`).
 * @param {*} fallback
 */
function readSetting(setting, fallback) {
    try {
        return game.settings.get(setting.module, setting.settingKey);
    } catch {
        return fallback;
    }
}

/**
 * Read one of the dashboard's own view-state settings.
 * @param {string} key
 * @param {*} fallback
 */
function readOwn(key, fallback) {
    try {
        return game.settings.get(MODULE_ID, key);
    } catch {
        return fallback;
    }
}

/**
 * Store a dashboard entry's value.
 * @param {object} setting  Registry entry.
 * @param {*} value
 */
function writeSetting(setting, value) {
    return game.settings.set(setting.module, setting.settingKey, value);
}

/**
 * Versions this user last opened the dashboard in, per module. Seeded from Nik's DnD5e Tweaks by the migration.
 * @returns {Record<string, string>}
 */
function readLastSeen() {
    return { ...(readOwn("dashboardLastSeen", {}) ?? {}) };
}

/**
 * Whether a value switches a feature off: an unchecked toggle, or a Select set to none / off / never.
 * @param {object} setting  Schema entry.
 * @param {*} value
 */
function isOffValue(setting, value) {
    if (setting.type === "Boolean") return !value;
    if (setting.type === "Select") return OFF_VALUES.has(value);
    return false;
}

/**
 * Short readable form of a value: On / Off, a choice label, or the value itself.
 * @param {object} setting
 * @param {*} value
 */
function valueLabel(setting, value) {
    if (setting.type === "Boolean") return value ? "On" : "Off";
    if (setting.type === "Select") return setting.choices?.find(c => c.value === value)?.label ?? String(value);
    if (setting.list) return `${parseListValue(String(value ?? "")).length} entries`;
    return String(value ?? "");
}

/**
 * Comparable form of a value, so form values and stored values can be compared with ===.
 * @param {object} setting
 * @param {*} value
 */
function normalizeValue(setting, value) {
    if (setting.type === "Boolean") return Boolean(value);
    if (setting.type === "Number") return Number(value);
    if (setting.list) return normalizeListValue(String(value ?? ""));
    if (setting.type === "Color") return String(value ?? "").toLowerCase();
    return String(value ?? "");
}

/**
 * First sentence of a hint, for the one-line summary on a feature row. Abbreviations like "e.g." don't end a sentence.
 * @param {string} hint
 */
function summarize(hint = "") {
    const protectedText = hint.replace(/\b(e\.g|i\.e|vs|etc)\./gi, m => m.replaceAll(".", "\u0000"));
    const match = protectedText.match(/^(.+?[.!?])(\s|$)/);
    return (match ? match[1] : protectedText).replaceAll("\u0000", ".");
}

/**
 * Escaped HTML of a text with every search token wrapped in <mark>.
 * @param {string} text
 * @param {string[]} tokens  Lower-case search tokens.
 */
function highlightText(text, tokens) {
    const escape = foundry.utils.escapeHTML;
    if (!tokens.length) return escape(text);
    const pattern = tokens
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .sort((a, b) => b.length - a.length)
        .join("|");
    // split() with a capture group puts the matches at the odd indexes.
    return text.split(new RegExp(`(${pattern})`, "gi"))
        .map((part, i) => (i % 2 ? `<mark>${escape(part)}</mark>` : escape(part)))
        .join("");
}

/**
 * Show the number of settings this user hasn't seen yet on the dashboard button in Configure Settings.
 * @param {HTMLElement} [root]  The Configure Settings element; found in the open window when omitted.
 */
export function refreshSettingsMenuBadge(root) {
    root ??= foundry.applications.instances.get("settings-config")?.element;
    if (!root) return;
    const count = NiksTweaksSettingsApp.countNewSettings();
    // Core's button and every add-on's button that opens this dashboard
    for (const id of getModuleIds()) {
        const button = root.querySelector(`[data-action="openSubmenu"][data-key="${id}.settingsDashboard"]`);
        if (!button) continue;
        button.querySelector(".nft-menu-new")?.remove();
        if (!count) continue;
        const badge = document.createElement("span");
        badge.className = "nft-menu-new";
        badge.textContent = `${count} new`;
        badge.dataset.tooltipText = `${count} new ${count === 1 ? "setting" : "settings"} since you last opened the dashboard`;
        button.append(badge);
    }
}

/**
 * ApplicationV2 Settings Dashboard of Nik's Tweaks: core and every registered add-on in one window.
 *
 * Feature-first: each top-level world setting is one row (its switch on the row), with its sub-options and the
 * players' personal choices (client settings linked by `pairedWith` / `parentKey`) folded into a panel below it.
 * Client settings with no world setting behind them are features of their own ("Just for You"), placed in the tab
 * their entry names with `homeTab` (default: the first tab). Players see only features they can change.
 */
export class NiksTweaksSettingsApp extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: DASHBOARD_ID,
        classes: ["nft-settings-app"],
        tag: "form",
        form: {
            handler: NiksTweaksSettingsApp.#onSubmit,
            closeOnSubmit: true
        },
        window: {
            title: "Nik's Tweaks",
            icon: "fa-solid fa-sliders",
            resizable: true
        },
        position: {
            width: 940,
            height: 760
        },
        actions: {
            resetDefaults: NiksTweaksSettingsApp.#onResetDefaults,
            exportSettings: NiksTweaksSettingsApp.#onExportSettings,
            importSettings: NiksTweaksSettingsApp.#onImportSettings,
            editList: NiksTweaksSettingsApp.#onEditList,
            editStatuses: NiksTweaksSettingsApp.#onEditChoices,
            editChoices: NiksTweaksSettingsApp.#onEditChoices,
            toggleFilter: NiksTweaksSettingsApp.#onToggleFilter,
            toggleFeature: NiksTweaksSettingsApp.#onToggleFeature,
            toggleMore: NiksTweaksSettingsApp.#onToggleMore,
            revealSetting: NiksTweaksSettingsApp.#onRevealSetting,
            resetSetting: NiksTweaksSettingsApp.#onResetSetting,
            resetFeature: NiksTweaksSettingsApp.#onResetFeature,
            close: function(event, target) { return this.close(); }
        }
    };

    /** @override */
    static PARTS = {
        dashboard: {
            template: "modules/niks-foundry-tweaks/templates/settings-dashboard.hbs",
            scrollable: [".nft-settings-content"]
        }
    };

    /**
     * Active tab tracking (client-side state during the session)
     */
    #activeTab = null;

    /** Features the user opened, kept across re-renders. @type {Set<string>} */
    #openFeatures = new Set();

    /**
     * Open list editor windows, keyed by setting key. Closed together with the dashboard.
     * @type {Map<string, NiksListEditorApp|NiksChoicePickerApp>}
     */
    #listEditors = new Map();

    /** Search text, kept across re-renders. */
    #query = "";

    /** Active quick filters (ids from FILTERS). */
    #filters = new Set();

    /** Stored value of every rendered setting at render time, normalized; the base for "unsaved". */
    #initialValues = new Map();

    /** Schema entries by key, from the last render. @type {Map<string, object>} */
    #settingsByKey = new Map();

    /** "New" boundary while this window is open. */
    #baseline = null;

    #refreshQueued = false;

    /**
     * Dashboard tabs from the settings registry (every registered module's schema, merged).
     * @returns {object[]}
     */
    static get SETTINGS_SCHEMA() {
        return getTabs();
    }

    /** @override */
    _onFirstRender(context, options) {
        // The form element survives re-renders, so its listeners are added once.
        this.element.addEventListener("change", () => this.#queueRefresh());
        this.element.addEventListener("input", () => this.#queueRefresh());
        // Clicking anywhere else closes the More menu.
        this.element.addEventListener("pointerdown", (event) => {
            if (!event.target.closest(".nft-more-menu")) this.#setMoreMenu(false);
        });
    }

    /* -------------------------------------------- */
    /*  Opening, deep links and "new" tracking       */
    /* -------------------------------------------- */

    /**
     * Open the dashboard, or bring it to the front, optionally at one setting.
     * Exposed as `game.modules.get("niks-foundry-tweaks").api.openSettings(key)`.
     * @param {object} [options]
     * @param {string} [options.key]  Setting to scroll to and highlight (its feature opens).
     * @param {string} [options.tab]  Tab to open when no key is given.
     * @returns {Promise<NiksTweaksSettingsApp>}
     */
    static async open({ key, tab } = {}) {
        let app = foundry.applications.instances.get(DASHBOARD_ID);
        if (!app) app = new NiksTweaksSettingsApp();
        if (tab) app.#activeTab = tab;
        if (app.rendered) app.bringToFront();
        else await app.render({ force: true });
        if (key) app.revealSetting(key);
        return app;
    }

    /**
     * Version boundaries for "New" badges, per module: the version this user last opened the dashboard in.
     * Before the first open, settings from the module's previous minor version on count as new.
     * @returns {Map<string, {version: string, inclusive: boolean}>}
     */
    static #newBaselines() {
        const seen = readLastSeen();
        const baselines = new Map();
        for (const id of getModuleIds()) {
            if (seen[id]) {
                baselines.set(id, { version: seen[id], inclusive: false });
                continue;
            }
            const [major = 0, minor = 0] = (game.modules.get(id)?.version ?? "0.0.0").split(".").map(Number);
            baselines.set(id, { version: `${major}.${Math.max(0, minor - 1)}.0`, inclusive: true });
        }
        return baselines;
    }

    /**
     * Whether an entry was added after its module's baseline.
     * @param {object} [setting]  Registry entry (`introduced`, `module`).
     * @param {Map<string, {version: string, inclusive: boolean}>} baselines
     */
    static #isNew(setting, baselines) {
        const introduced = setting?.introduced;
        const baseline = baselines.get(setting?.module);
        if (!introduced || !baseline) return false;
        if (baseline.inclusive && (introduced === baseline.version)) return true;
        return foundry.utils.isNewerVersion(introduced, baseline.version);
    }

    /**
     * Whether a setting exists in this world: its module requirement and condition hold.
     * @param {object} setting
     */
    static #isAvailable(setting) {
        if (setting.requiresModule && !game.modules.get(setting.requiresModule)?.active) return false;
        if ((typeof setting.condition === "function") && !setting.condition()) return false;
        return true;
    }

    /**
     * Whether a setting is shown to this user: it is available, and players only get personal settings.
     * @param {object} setting
     * @param {string} tabId
     * @param {boolean} canModify
     */
    static #isVisible(setting, tabId, canModify) {
        if (!NiksTweaksSettingsApp.#isAvailable(setting)) return false;
        return canModify || (tabId === PERSONAL_TAB);
    }

    /**
     * Number of settings this user hasn't seen yet. Shown on the button in Configure Settings.
     * @returns {number}
     */
    static countNewSettings() {
        const canModify = game.user.can("SETTINGS_MODIFY");
        const baselines = NiksTweaksSettingsApp.#newBaselines();
        let count = 0;
        for (const tab of NiksTweaksSettingsApp.SETTINGS_SCHEMA) {
            for (const sec of tab.sections) {
                for (const s of sec.settings) {
                    if (NiksTweaksSettingsApp.#isVisible(s, tab.id, canModify)
                        && NiksTweaksSettingsApp.#isNew(s, baselines)) count++;
                }
            }
        }
        return count;
    }

    /* -------------------------------------------- */
    /*  Context                                     */
    /* -------------------------------------------- */

    /**
     * Group the schema into features. A feature is a top-level setting outside Personal Preferences, or a
     * personal setting that neither belongs to a world setting nor to another personal setting.
     * @param {object[]} schema
     * @returns {{features: Map<string, object>, order: object[]}}  Features by key, and the tabs → sections →
     *   feature keys to show them in.
     */
    static #groupFeatures(schema) {
        const all = schema.flatMap(tab => tab.sections.flatMap(sec => sec.settings.map(s => ({ s, tab, sec }))));
        const byKey = new Map(all.map(e => [e.s.key, e]));
        const features = new Map();
        const order = schema.filter(t => t.id !== PERSONAL_TAB)
            .map(tab => ({ tab, sections: tab.sections.map(sec => ({ sec, keys: [] })) }));

        /** Top-level ancestor of an entry, following `parentKey`. */
        const rootOf = (key) => {
            let entry = byKey.get(key);
            const seen = new Set();
            while (entry?.s.parentKey && byKey.has(entry.s.parentKey) && !seen.has(entry.s.key)) {
                seen.add(entry.s.key);
                entry = byKey.get(entry.s.parentKey);
            }
            return entry;
        };
        const newFeature = (entry) => ({ setting: entry.s, tab: entry.tab, sec: entry.sec, options: [], personal: [] });

        // World features and their options
        for (const entry of all) {
            if (entry.tab.id === PERSONAL_TAB) continue;
            if (!entry.s.parentKey || !byKey.has(entry.s.parentKey)) {
                features.set(entry.s.key, newFeature(entry));
                order.find(o => o.tab === entry.tab).sections.find(o => o.sec === entry.sec).keys.push(entry.s.key);
            }
        }
        for (const entry of all) {
            if ((entry.tab.id === PERSONAL_TAB) || features.has(entry.s.key)) continue;
            features.get(rootOf(entry.s.key)?.s.key)?.options.push(entry.s);
        }

        // Personal settings: into the feature of their world setting, or of their personal parent
        const hostOf = (s, depth = 0) => {
            if (depth > 10) return null;
            const pair = s.pairedWith && byKey.get(s.pairedWith);
            if (pair && (pair.tab.id !== PERSONAL_TAB)) return rootOf(pair.s.key)?.s.key ?? null;
            if (s.parentKey && byKey.has(s.parentKey)) {
                const parent = byKey.get(s.parentKey).s;
                return features.has(parent.key) ? parent.key : hostOf(parent, depth + 1);
            }
            return null;
        };
        for (const entry of all) {
            if (entry.tab.id !== PERSONAL_TAB) continue;
            const host = hostOf(entry.s);
            if (host && features.has(host)) {
                features.get(host).personal.push(entry.s);
                continue;
            }
            if (entry.s.parentKey && byKey.has(entry.s.parentKey)) continue; // parent wasn't placed: skip
            // Personal-only feature: its own row in the tab it names, in a "Just for You" section
            const feature = newFeature(entry);
            feature.personalOnly = true;
            features.set(entry.s.key, feature);
            const home = order.find(o => o.tab.id === entry.s.homeTab) ?? order[0];
            if (!home) continue;
            let section = home.sections.find(o => o.sec.id === PERSONAL_SECTION.id);
            if (!section) home.sections.push(section = { sec: PERSONAL_SECTION, keys: [] });
            section.keys.push(entry.s.key);
        }
        // Children of personal-only features
        for (const entry of all) {
            if ((entry.tab.id !== PERSONAL_TAB) || !entry.s.parentKey) continue;
            const root = rootOf(entry.s.key);
            const feature = features.get(root?.s.key);
            if (feature?.personalOnly && (root.s.key !== entry.s.key) && !feature.personal.includes(entry.s)) {
                feature.personal.push(entry.s);
            }
        }
        return { features, order };
    }

    /** @override */
    async _prepareContext(options) {
        const canModify = game.user.can("SETTINGS_MODIFY");
        this.#baseline ??= NiksTweaksSettingsApp.#newBaselines();
        const baselines = this.#baseline;

        const schema = NiksTweaksSettingsApp.SETTINGS_SCHEMA;
        const all = schema.flatMap(tab => tab.sections.flatMap(sec => sec.settings));
        const byKey = new Map(all.map(s => [s.key, s]));
        this.#settingsByKey = byKey;
        this.#initialValues.clear();

        const unavailableFor = (s) => {
            const mod = getUnavailableWith(s.unavailableWith);
            return mod?.isActive() ? mod : null;
        };
        const docsFor = (s) => {
            const docs = s.docs ?? byKey.get(s.pairedWith)?.docs;
            const base = getModule(s.module)?.docsUrl;
            return (docs && base) ? base + docs : null;
        };
        const depthOf = (s, rootKey) => {
            let depth = 0;
            let cur = s;
            while (cur?.parentKey && (cur.parentKey !== rootKey) && byKey.has(cur.parentKey) && (depth < 5)) {
                cur = byKey.get(cur.parentKey);
                depth++;
            }
            return depth;
        };

        /** Template data of one setting's control. */
        const entryFor = (s, rootKey) => {
            const value = readSetting(s, s.default);
            this.#initialValues.set(s.key, normalizeValue(s, value));
            const isPersonal = (s.scope === "client") || (s.scope === "user");
            const unavailableModule = unavailableFor(s);
            const editable = canModify || isPersonal;
            const pair = s.pairedWith ? byKey.get(s.pairedWith) : null;
            return {
                ...s,
                value,
                choices: s.type === "Select"
                    ? (s.choices ?? []).map(c => ({ ...c, selected: c.value === value }))
                    : [],
                listCount: s.list ? parseListValue(value).length : 0,
                depth: depthOf(s, rootKey),
                // A personal choice that only works while its world setting is on
                worldKey: (pair && (pair.scope === "world") && !s.overridesWorld) ? pair.key : null,
                isNew: NiksTweaksSettingsApp.#isNew(s, baselines),
                locked: !editable || Boolean(unavailableModule),
                canReset: editable && !unavailableModule,
                defaultLabel: ["FilePicker", "String"].includes(s.type) && !s.list ? "" : valueLabel(s, s.default),
                searchText: [s.name, s.hint, s.settingKey, ...(s.keywords ?? [])].join(" ").toLowerCase()
            };
        };

        const { features, order } = NiksTweaksSettingsApp.#groupFeatures(schema);
        let newCount = 0;
        const tabs = [];
        for (const { tab, sections: secOrder } of order) {
            const sections = [];
            const alsoActive = [];
            let tabNew = 0;
            for (const { sec, keys } of secOrder) {
                const list = [];
                for (const key of keys) {
                    const f = features.get(key);
                    const s = f.setting;
                    if (!NiksTweaksSettingsApp.#isAvailable(s)) continue;
                    const unavailableModule = unavailableFor(s);
                    const personal = f.personal.filter(p => NiksTweaksSettingsApp.#isAvailable(p));
                    const options = f.options.filter(o => NiksTweaksSettingsApp.#isAvailable(o));
                    const worldOn = !isOffValue(s, readSetting(s, s.default)) && !unavailableModule;

                    // The personal choice that turns the whole feature off for this user
                    const primary = personal.find(p => (p.pairedWith === s.key) && !p.parentKey) ?? null;

                    let row;
                    let shownOptions;
                    let shownPersonal;
                    if (canModify || f.personalOnly) {
                        row = s;
                        shownOptions = canModify ? options : [];
                        shownPersonal = personal;
                    } else {
                        // Players: only features they can change, and only while the GM has them on
                        // (or the personal choice can override an off world setting)
                        if (!personal.length) {
                            if (worldOn && (s.scope === "world")) alsoActive.push({ name: s.name, summary: summarize(s.hint) });
                            continue;
                        }
                        if (!worldOn && !personal.some(p => p.overridesWorld)) continue;
                        row = primary;
                        shownOptions = [];
                        shownPersonal = personal.filter(p => p !== primary);
                    }

                    const rowEntry = row ? entryFor(row, s.key) : null;
                    const optionEntries = shownOptions.map(o => entryFor(o, s.key));
                    const personalEntries = shownPersonal.map(p => entryFor(p, s.key));
                    const every = [rowEntry, ...optionEntries, ...personalEntries].filter(Boolean);
                    const isNew = every.some(e => e.isNew);
                    if (isNew) {
                        tabNew++;
                        newCount++;
                    }
                    const sourceModule = getModule(s.module);
                    list.push({
                        key: s.key,
                        name: s.name,
                        hint: s.hint ?? "",
                        summary: summarize(s.hint),
                        row: rowEntry,
                        primaryKey: (canModify && primary) ? primary.key : null,
                        options: optionEntries,
                        personal: personalEntries,
                        optionCount: optionEntries.length + personalEntries.length,
                        personalOnly: Boolean(f.personalOnly),
                        isNew,
                        requiresReload: every.some(e => e.requiresReload),
                        unavailable: Boolean(unavailableModule),
                        unavailableLabel: unavailableModule?.label ?? "",
                        unavailableReason: unavailableModule
                            ? `${unavailableModule.label} is active and does this itself, so this feature is paused. Your choices are kept for when ${unavailableModule.label} is turned off.`
                            : "",
                        docsUrl: docsFor(s),
                        moduleTitle: getModuleIds().length > 1 ? (sourceModule?.title ?? "") : "",
                        canReset: every.some(e => e.canReset),
                        open: this.#openFeatures.has(s.key),
                        searchText: [tab.label, sec.title, ...every.map(e => e.searchText)].join(" ")
                    });
                }
                if (list.length) sections.push({ id: sec.id, title: sec.title, icon: sec.icon, features: list });
            }
            if (sections.length || alsoActive.length) {
                tabs.push({ id: tab.id, label: tab.label, icon: tab.icon, sections, alsoActive, newCount: tabNew });
            }
        }

        // Players land on the first tab with something to change
        if (!this.#activeTab || !tabs.some(t => t.id === this.#activeTab)) {
            this.#activeTab = (tabs.find(t => t.sections.length) ?? tabs[0])?.id ?? null;
        }
        for (const t of tabs) t.active = (t.id === this.#activeTab);

        return {
            canModify,
            filters: FILTERS,
            navTabs: tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon, newCount: t.newCount, active: t.active })),
            tabs,
            newCount
        };
    }

    /* -------------------------------------------- */
    /*  Rendering and listeners                     */
    /* -------------------------------------------- */

    /** @override */
    _onRender(context, options) {
        const html = this.element;

        // Tabs: switch normally; while searching or filtering, jump to that tab's results instead.
        for (const tabBtn of html.querySelectorAll(".nft-nav-tab")) {
            tabBtn.addEventListener("click", () => {
                const tabId = tabBtn.dataset.tab;
                if (this.#isFiltering) {
                    html.querySelector(`.nft-tab-panel.active[data-tab="${tabId}"]`)
                        ?.scrollIntoView({ block: "start", behavior: "smooth" });
                    return;
                }
                this.#activateTab(tabId);
            });
        }

        // Search
        const searchInput = html.querySelector(".nft-search-input");
        if (searchInput) {
            searchInput.value = this.#query;
            searchInput.addEventListener("input", () => {
                this.#query = searchInput.value;
                this.#applyFilters();
            });
            searchInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    const first = html.querySelector(".nft-tab-panel.active .nft-feature:not(.nft-row-hidden)");
                    if (first) this.revealSetting(first.dataset.feature);
                } else if ((event.key === "Escape") && (this.#query || this.#filters.size)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.#clearFilters();
                }
            });
        }
        for (const btn of html.querySelectorAll(".nft-search-clear, .nft-btn-clear-search")) {
            btn.addEventListener("click", () => {
                this.#clearFilters();
                searchInput?.focus();
            });
        }

        // FilePicker buttons
        for (const btn of html.querySelectorAll(".nft-file-picker-btn")) {
            btn.addEventListener("click", () => {
                const targetInput = html.querySelector(`#${CSS.escape(btn.dataset.target)}`);
                if (!targetInput) return;
                const fp = new foundry.applications.apps.FilePicker.implementation({
                    type: btn.dataset.type || "image",
                    current: targetInput.value,
                    callback: (path) => {
                        targetInput.value = path;
                        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
                fp.browse();
            });
        }

        // Color picker <-> hex text input
        for (const group of html.querySelectorAll(".nft-color-group")) {
            const colorInput = group.querySelector(".nft-color-input");
            const textInput = group.querySelector(".nft-color-text");
            if (!colorInput || !textInput) continue;
            colorInput.addEventListener("input", () => { textInput.value = colorInput.value; });
            textInput.addEventListener("input", () => {
                const v = textInput.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) colorInput.value = v;
            });
        }

        // More menu: Escape closes it
        html.querySelector(".nft-more-pop")?.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            this.#setMoreMenu(false);
            html.querySelector(".nft-more-toggle")?.focus();
        });

        // JSON import
        html.querySelector(".nft-file-import-input")?.addEventListener("change", (e) => this.#onFileSelected(e));

        this.#refreshRowStates();
        this.#applyFilters();
    }

    /** @override */
    async close(options = {}) {
        const pending = this.rendered && !options.submitted && !options.force ? this.#countPending() : 0;
        if (pending) {
            const discard = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Unsaved Changes" },
                content: `<p>You have <strong>${pending}</strong> unsaved ${pending === 1 ? "change" : "changes"}. Close without saving?</p>`,
                yes: { label: "Discard Changes", icon: "fa-solid fa-trash" },
                no: { label: "Keep Editing", icon: "fa-solid fa-pen" },
                modal: true
            });
            if (!discard) return this;
        }
        return super.close(options);
    }

    /** @override */
    _onClose(options) {
        super._onClose(options);
        for (const editor of this.#listEditors.values()) editor.close();
        this.#listEditors.clear();

        // Everything shown in this window counts as seen.
        this.#baseline = null;
        const stored = readOwn("dashboardLastSeen", {}) ?? {};
        const seen = readLastSeen();
        let changed = false;
        for (const id of getModuleIds()) {
            const version = game.modules.get(id)?.version;
            if (version && (stored[id] !== version)) {
                seen[id] = version;
                changed = true;
            }
        }
        if (changed) {
            game.settings.set(MODULE_ID, "dashboardLastSeen", seen)
                .then(() => refreshSettingsMenuBadge());
        }
    }

    /* -------------------------------------------- */
    /*  Tabs, features, reveal                      */
    /* -------------------------------------------- */

    /**
     * Show one tab (outside search and filter mode).
     * @param {string} tabId
     */
    #activateTab(tabId) {
        this.#activeTab = tabId;
        const html = this.element;
        for (const btn of html.querySelectorAll(".nft-nav-tab")) btn.classList.toggle("active", btn.dataset.tab === tabId);
        for (const panel of html.querySelectorAll(".nft-tab-panel")) panel.classList.toggle("active", panel.dataset.tab === tabId);
        html.querySelector(".nft-settings-content")?.scrollTo({ top: 0 });
    }

    /**
     * Open or close a feature's panel.
     * @param {HTMLElement} article  The feature's element.
     * @param {boolean} open
     */
    #setFeatureOpen(article, open) {
        const key = article.dataset.feature;
        if (open) this.#openFeatures.add(key);
        else this.#openFeatures.delete(key);
        article.classList.toggle("nft-open", open);
        article.querySelector(".nft-feature-toggle")?.setAttribute("aria-expanded", String(open || article.classList.contains("nft-search-open")));
    }

    /**
     * Clear search and filters, open the tab and feature of a setting, scroll to it and highlight it.
     * @param {string} key  A setting key, or a feature's key.
     * @returns {boolean}  Whether the setting is in this window.
     */
    revealSetting(key) {
        key = resolveSettingId(key, MODULE_ID) ?? key;
        const html = this.element;
        const target = html?.querySelector(`.nft-setting[data-key="${key}"]`)
            ?? html?.querySelector(`.nft-feature[data-feature="${key}"]`);
        const article = target?.closest(".nft-feature");
        if (!article) {
            ui.notifications.warn("That setting isn't available to you here.");
            return false;
        }
        this.#clearFilters();
        this.#activateTab(article.closest(".nft-tab-panel")?.dataset.tab);
        this.#setFeatureOpen(article, true);
        const flash = target.classList.contains("nft-option") ? target : article;
        flash.scrollIntoView({ block: "center" });
        flash.classList.remove("nft-flash");
        void flash.offsetWidth; // restart the animation
        flash.classList.add("nft-flash");
        const control = target.classList.contains("nft-setting")
            ? target.querySelector(":is(input:not([type='hidden']), select, button:not(.nft-row-reset)):not(:disabled)")
            : article.querySelector(".nft-feature-toggle");
        control?.focus({ preventScroll: true });
        return true;
    }

    /**
     * @param {boolean} open
     */
    #setMoreMenu(open) {
        const pop = this.element?.querySelector(".nft-more-pop");
        if (!pop) return;
        pop.hidden = !open;
        this.element.querySelector(".nft-more-toggle")?.setAttribute("aria-expanded", String(open));
        if (open) pop.querySelector("button:not(:disabled)")?.focus();
    }

    /* -------------------------------------------- */
    /*  Values, change markers, pending changes      */
    /* -------------------------------------------- */

    /**
     * Current form value of a setting, or the stored value when it isn't in the form.
     * @param {string} key
     */
    #currentValue(key) {
        const setting = this.#settingsByKey.get(key);
        const control = this.element?.querySelector(`.nft-setting[data-key="${key}"] [name="${key}"]`);
        if (!setting || !control) return setting ? readSetting(setting, setting.default) : undefined;
        if (setting.type === "Boolean") return control.checked;
        if (setting.type === "Number") return Number(control.value);
        return control.value;
    }

    /**
     * Put a value into a setting's control and announce the change.
     * @param {HTMLElement} row  The setting's `.nft-setting` element.
     * @param {object} setting
     * @param {*} value
     */
    #writeControl(row, setting, value) {
        const control = row.querySelector(`[name="${setting.key}"]`);
        if (!control || control.disabled) return;
        if (setting.type === "Boolean") control.checked = Boolean(value);
        else control.value = value;
        if (setting.type === "Color") {
            const text = row.querySelector(".nft-color-text");
            if (text) text.value = value;
        }
        if (setting.list) {
            const label = row.querySelector(".nft-list-count");
            if (label) label.textContent = parseListValue(String(value)).length;
            row.querySelector(".nft-list-edit-btn")?.classList.add("nft-list-modified");
        }
        control.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /** Number of settings whose form value differs from the stored value. */
    #countPending() {
        let count = 0;
        for (const [key, initial] of this.#initialValues) {
            const setting = this.#settingsByKey.get(key);
            if (setting && (normalizeValue(setting, this.#currentValue(key)) !== initial)) count++;
        }
        return count;
    }

    #queueRefresh() {
        if (this.#refreshQueued) return;
        this.#refreshQueued = true;
        requestAnimationFrame(() => {
            this.#refreshQueued = false;
            if (this.rendered) this.#refreshRowStates();
        });
    }

    /**
     * Update everything that depends on the current form values: locked options, changed / unsaved markers,
     * on / off state of features, tab counts, filter counts and the Save button.
     */
    #refreshRowStates() {
        const html = this.element;
        if (!html) return;
        this.#updateDependentStates();
        let pending = 0;

        for (const row of html.querySelectorAll(".nft-setting[data-key]")) {
            const setting = this.#settingsByKey.get(row.dataset.key);
            if (!setting) continue;
            const current = normalizeValue(setting, this.#currentValue(setting.key));
            const modified = current !== normalizeValue(setting, setting.default);
            const dirty = current !== this.#initialValues.get(setting.key);
            if (dirty) pending++;
            row.classList.toggle("nft-modified", modified);
            row.classList.toggle("nft-dirty", dirty);
        }

        for (const article of html.querySelectorAll(".nft-feature")) {
            const rowKey = article.dataset.rowKey;
            const rowSetting = rowKey ? this.#settingsByKey.get(rowKey) : null;
            const off = rowSetting ? isOffValue(rowSetting, this.#currentValue(rowKey)) : false;
            article.dataset.off = String(off);
            article.classList.toggle("nft-off", off);
            article.classList.toggle("nft-modified", Boolean(article.querySelector(".nft-setting.nft-modified")));
            article.classList.toggle("nft-dirty", Boolean(article.querySelector(".nft-setting.nft-dirty")));

            // GM: their own personal choice turned the feature off on their screen
            const primary = article.dataset.primary ? this.#settingsByKey.get(article.dataset.primary) : null;
            const personalOff = Boolean(primary) && !off && isOffValue(primary, this.#currentValue(primary.key));
            const tag = article.querySelector(".nft-badge.personal-off");
            if (tag) tag.hidden = !personalOff;
        }

        // Tabs: how many features are on
        for (const panel of html.querySelectorAll(".nft-tab-panel")) {
            const articles = panel.querySelectorAll(".nft-feature");
            const on = panel.querySelectorAll(".nft-feature[data-off='false']:not(.nft-unavailable)").length;
            const count = html.querySelector(`[data-tab-count="${panel.dataset.tab}"]`);
            if (count) {
                count.textContent = articles.length ? `${on}/${articles.length}` : "";
                count.dataset.tooltipText = `${on} of ${articles.length} features on`;
            }
        }

        // Filter counts
        for (const chip of html.querySelectorAll(".nft-filter-chip")) {
            const id = chip.dataset.filter;
            let count = 0;
            for (const article of html.querySelectorAll(".nft-feature")) {
                if (this.#featureMatchesFilter(article, id)) count++;
            }
            chip.querySelector(".nft-filter-count").textContent = count;
            chip.hidden = !count && !this.#filters.has(id);
        }

        // Save button and footer
        const save = html.querySelector(".nft-save-count");
        if (save) {
            save.textContent = pending;
            save.hidden = !pending;
        }
        const note = html.querySelector(".nft-pending-note");
        if (note) {
            note.textContent = pending ? `${pending} unsaved ${pending === 1 ? "change" : "changes"}` : "";
            note.hidden = !pending;
        }
    }

    /**
     * Lock options whose parent setting is off, and dim personal choices whose world setting is off.
     * Disabled controls aren't submitted, so their stored values stay as they are.
     */
    #updateDependentStates() {
        const html = this.element;
        const canModify = game.user.can("SETTINGS_MODIFY");
        const isOn = (key) => {
            const setting = this.#settingsByKey.get(key);
            return setting ? !isOffValue(setting, this.#currentValue(key)) : true;
        };

        for (const row of html.querySelectorAll(".nft-option")) {
            const article = row.closest(".nft-feature");
            const parentOn = !row.dataset.parent || isOn(row.dataset.parent);
            const personal = (row.dataset.scope === "client") || (row.dataset.scope === "user");
            const editable = (canModify || personal) && !article?.classList.contains("nft-unavailable");
            row.classList.toggle("nft-parent-disabled", !parentOn);
            for (const ctrl of row.querySelectorAll(".nft-setting-control :is(input, select, button)")) {
                ctrl.disabled = !parentOn || !editable;
            }
            row.classList.toggle("nft-world-off", Boolean(row.dataset.world) && !isOn(row.dataset.world));
        }
        // The world group says why its options are locked
        for (const group of html.querySelectorAll(".nft-option-group[data-group='world']")) {
            const rowKey = group.closest(".nft-feature")?.dataset.rowKey;
            group.classList.toggle("nft-group-off", Boolean(rowKey) && !isOn(rowKey));
        }
    }

    /* -------------------------------------------- */
    /*  Search and filters                          */
    /* -------------------------------------------- */

    get #isFiltering() {
        return Boolean(this.#query.trim()) || (this.#filters.size > 0);
    }

    /**
     * @param {HTMLElement} article  A feature's element.
     * @param {string} filter
     */
    #featureMatchesFilter(article, filter) {
        switch (filter) {
            case "changed": return article.classList.contains("nft-modified");
            case "new": return article.dataset.new === "true";
            case "off": return article.dataset.off === "true";
            case "reload": return article.dataset.reload === "true";
            case "unavailable": return article.classList.contains("nft-unavailable");
            default: return true;
        }
    }

    #clearFilters() {
        this.#query = "";
        this.#filters.clear();
        const input = this.element?.querySelector(".nft-search-input");
        if (input) input.value = "";
        this.#applyFilters();
    }

    /**
     * Show the features that match every search word (in the feature or any of its options, in any order, also in
     * keywords) and every active filter, across all tabs. A match inside an option opens the feature and marks
     * the option.
     */
    #applyFilters() {
        const html = this.element;
        if (!html) return;
        const tokens = this.#query.toLowerCase().split(/\s+/).filter(Boolean);
        const filtering = this.#isFiltering;
        html.querySelector(".nft-dashboard-wrapper")?.classList.toggle("nft-filtering", filtering);

        const matchesByTab = {};
        let total = 0;
        for (const article of html.querySelectorAll(".nft-feature")) {
            const text = article.dataset.searchText ?? "";
            const visible = !filtering || (tokens.every(t => text.includes(t))
                && [...this.#filters].every(f => this.#featureMatchesFilter(article, f)));
            article.classList.toggle("nft-row-hidden", !visible);
            if (filtering && visible) {
                total++;
                const tabId = article.closest(".nft-tab-panel")?.dataset.tab;
                if (tabId) matchesByTab[tabId] = (matchesByTab[tabId] ?? 0) + 1;
            }

            // Options that contain a search word open the feature
            const shownTokens = visible ? tokens : [];
            let optionHit = false;
            for (const option of article.querySelectorAll(".nft-option")) {
                const hit = shownTokens.length > 0 && shownTokens.some(t => (option.dataset.searchText ?? "").includes(t));
                option.classList.toggle("nft-hit", hit);
                optionHit ||= hit;
            }
            const hintEl = article.querySelector(".nft-feature-hint");
            const hintHit = shownTokens.length > 0 && Boolean(hintEl)
                && shownTokens.some(t => hintEl.textContent.toLowerCase().includes(t))
                && !shownTokens.some(t => article.querySelector(".nft-feature-name").textContent.toLowerCase().includes(t));
            article.classList.toggle("nft-search-open", optionHit || hintHit);
            article.querySelector(".nft-feature-toggle")?.setAttribute("aria-expanded",
                String(article.classList.contains("nft-open") || optionHit || hintHit));

            // Highlight the words
            for (const el of article.querySelectorAll(".nft-feature-name, .nft-feature-summary, .nft-feature-hint, .nft-option-name, .nft-option-hint")) {
                el.dataset.plain ??= el.textContent;
                if (shownTokens.length) el.innerHTML = highlightText(el.dataset.plain, shownTokens);
                else if (el.querySelector("mark")) el.textContent = el.dataset.plain;
            }
        }

        for (const sec of html.querySelectorAll(".nft-section")) {
            sec.classList.toggle("nft-row-hidden", !sec.querySelector(".nft-feature:not(.nft-row-hidden)"));
        }
        for (const panel of html.querySelectorAll(".nft-tab-panel")) {
            const id = panel.dataset.tab;
            panel.classList.toggle("active", filtering ? Boolean(matchesByTab[id]) : (id === this.#activeTab));
        }
        for (const btn of html.querySelectorAll(".nft-nav-tab")) {
            const count = matchesByTab[btn.dataset.tab] ?? 0;
            const badge = btn.querySelector(".tab-badge");
            if (badge) {
                badge.textContent = count;
                badge.hidden = !(filtering && count);
            }
            btn.classList.toggle("active", !filtering && (btn.dataset.tab === this.#activeTab));
            btn.classList.toggle("nft-no-matches", filtering && !count);
        }
        for (const chip of html.querySelectorAll(".nft-filter-chip")) {
            const on = this.#filters.has(chip.dataset.filter);
            chip.classList.toggle("active", on);
            chip.setAttribute("aria-pressed", String(on));
        }

        const clear = html.querySelector(".nft-search-clear");
        if (clear) clear.hidden = !filtering;
        const noResults = html.querySelector(".nft-no-results");
        if (noResults) noResults.hidden = !(filtering && !total);
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /**
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onToggleFilter(event, target) {
        const id = target.dataset.filter;
        if (this.#filters.has(id)) this.#filters.delete(id);
        else this.#filters.add(id);
        this.#applyFilters();
        this.#refreshRowStates();
    }

    /**
     * Open or close a feature's options.
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onToggleFeature(event, target) {
        const article = target.closest(".nft-feature");
        if (!article) return;
        // While a search opened it, the first click closes it
        const shown = article.classList.contains("nft-open") || article.classList.contains("nft-search-open");
        article.classList.remove("nft-search-open");
        this.#setFeatureOpen(article, !shown);
    }

    /**
     * @this {NiksTweaksSettingsApp}
     */
    static #onToggleMore(event, target) {
        this.#setMoreMenu(this.element.querySelector(".nft-more-pop")?.hidden ?? false);
    }

    /**
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onRevealSetting(event, target) {
        event.preventDefault();
        this.revealSetting(target.dataset.key);
    }

    /**
     * Put one setting back to its default value (stored on Save).
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onResetSetting(event, target) {
        const setting = this.#settingsByKey.get(target.dataset.key);
        const row = target.closest(".nft-setting");
        if (!setting || !row) return;
        this.#writeControl(row, setting, setting.default);
    }

    /**
     * Put every setting this user can change in a feature back to its default (stored on Save).
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onResetFeature(event, target) {
        const article = target.closest(".nft-feature");
        if (!article) return;
        // The feature's own switch first, so its options unlock before they are reset
        const rows = [...article.querySelectorAll(".nft-setting[data-key]")];
        for (const row of rows) {
            const setting = this.#settingsByKey.get(row.dataset.key);
            if (setting) this.#writeControl(row, setting, setting.default);
            this.#updateDependentStates();
        }
    }

    /**
     * Open the pop-out list editor for a list setting. Apply writes the value into the
     * dashboard's hidden input; it is stored when the dashboard is saved.
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onEditList(event, target) {
        const key = target.dataset.key;
        const setting = getAllSettings().find(s => s.key === key);
        const input = this.element.querySelector(`input[name="${key}"]`);
        if (!setting || !input) return;

        const open = this.#listEditors.get(key);
        if (open?.rendered) {
            open.bringToFront();
            return;
        }

        const editor = new NiksListEditorApp({
            settingKey: key.replaceAll(".", "-"),
            settingName: setting.name,
            hint: setting.hint,
            value: input.value,
            defaultValue: setting.default,
            choices: setting.listChoices,
            choiceDefault: setting.listChoiceDefault,
            onApply: (value) => {
                input.value = value;
                const count = parseListValue(value).length;
                const label = target.querySelector(".nft-list-count");
                if (label) label.textContent = count;
                target.classList.add("nft-list-modified");
                target.title = "Edited. Use Save to store this list.";
                this.#queueRefresh();
            }
        });
        editor.addEventListener("close", () => this.#listEditors.delete(key), { once: true });
        this.#listEditors.set(key, editor);
        editor.render({ force: true });
    }

    /**
     * Open the picker of a list setting with `statusPicker` or `choicePicker`. Apply writes the values into the
     * dashboard's hidden input; they are stored when the dashboard is saved.
     * @this {NiksTweaksSettingsApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onEditChoices(event, target) {
        const key = target.dataset.key;
        const setting = getAllSettings().find(s => s.key === key);
        const input = this.element.querySelector(`input[name="${key}"]`);
        if (!setting || !input) return;

        const open = this.#listEditors.get(key);
        if (open?.rendered) {
            open.bringToFront();
            return;
        }

        const options = {
            settingKey: key.replaceAll(".", "-"),
            settingName: setting.name,
            hint: setting.hint,
            value: input.value,
            defaultValue: setting.default,
            onApply: (value) => {
                input.value = value;
                const label = target.querySelector(".nft-list-count");
                if (label) label.textContent = parseListValue(value).length;
                target.classList.add("nft-list-modified");
                target.title = "Edited. Use Save to store this choice.";
                this.#queueRefresh();
            }
        };
        let picker;
        if (setting.choicePicker) {
            const config = setting.choicePicker;
            // Sibling settings by their own key, read from the dashboard's current (unsaved) form values
            const readValue = (settingKey) => this.#currentValue(settingKey.includes(".") ? settingKey : `${setting.module}.${settingKey}`);
            let mode = config.mode;
            if (typeof mode === "function") {
                try {
                    mode = mode(readValue);
                } catch (err) {
                    console.error(`${MODULE_ID} | Choice picker mode of ${key} failed:`, err);
                    mode = "hide";
                }
            }
            picker = new NiksChoicePickerApp({
                ...options,
                getGroups: config.getGroups,
                normalize: config.normalize,
                noun: config.noun,
                resetTitle: config.resetTitle,
                mode
            });
        } else {
            picker = new NiksStatusPickerApp({ ...options, isCondition: setting.statusPicker?.isCondition });
        }
        picker.addEventListener("close", () => this.#listEditors.delete(key), { once: true });
        this.#listEditors.set(key, picker);
        picker.render({ force: true });
    }


    /**
     * Handles form submit and saving settings
     */
    static async #onSubmit(event, form, formData) {
        const canModify = game.user.can("SETTINGS_MODIFY");
        let hasChanges = false;
        let requiresReload = false;

        // Iterate through all settings in schema
        for (const tab of NiksTweaksSettingsApp.SETTINGS_SCHEMA) {
            for (const sec of tab.sections) {
                for (const s of sec.settings) {
                    // Enforce permission: non-authorized users can only save client/user-scoped settings
                    if (s.scope !== "client" && s.scope !== "user" && !canModify) continue;
                    if (s.requiresModule && !game.modules.get(s.requiresModule)?.active) continue;
                    if (typeof s.condition === "function" && !s.condition()) continue;

                    const rawVal = formData.object[s.key];

                    // If the raw value is absent (undefined), the input was disabled
                    // (e.g. a child setting whose parent is off) and was not submitted
                    // by the browser. Skip it entirely to preserve the stored value.
                    if (rawVal === undefined) continue;

                    let formVal = rawVal;
                    if (s.type === "Boolean") {
                        formVal = Boolean(formVal);
                    } else if (s.type === "Number") {
                        formVal = Number(formVal);
                    } else if (s.list) {
                        formVal = normalizeListValue(formVal);
                    }

                    const currentVal = readSetting(s, s.default);
                    if (formVal !== currentVal) {
                        await writeSetting(s, formVal);
                        hasChanges = true;
                        if (s.requiresReload) requiresReload = true;
                    }
                }
            }
        }

        if (hasChanges) {
            ui.notifications.info("Nik's Tweaks settings saved successfully.");
            if (requiresReload) {
                foundry.applications.settings.SettingsConfig.reloadConfirm();
            }
        }
    }

    /**
     * Resets all settings to their default values (world + client for GMs, client-only for non-GMs)
     */
    static async #onResetDefaults(event, target) {
        const canModify = game.user.can("SETTINGS_MODIFY");

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Reset Settings to Default" },
            content: canModify
                ? "<p>Are you sure you want to reset all <strong>Nik's Tweaks</strong> settings to their default values?</p>"
                : "<p>Are you sure you want to reset your personal <strong>Nik's Tweaks</strong> preferences to their default values?</p>",
            modal: true
        });

        if (!confirmed) return;

        let requiresReload = false;
        for (const tab of NiksTweaksSettingsApp.SETTINGS_SCHEMA) {
            for (const sec of tab.sections) {
                for (const s of sec.settings) {
                    if (!canModify && s.scope !== "client" && s.scope !== "user") continue;
                    if (s.requiresModule && !game.modules.get(s.requiresModule)?.active) continue;
                    if (typeof s.condition === "function" && !s.condition()) continue;
                    const currentVal = readSetting(s, s.default);
                    if (currentVal !== s.default) {
                        await writeSetting(s, s.default);
                        if (s.requiresReload) requiresReload = true;
                    }
                }
            }
        }

        ui.notifications.info(canModify
            ? "Nik's Tweaks settings have been reset to default values."
            : "Your personal preferences have been reset to default values.");
        if (requiresReload) {
            foundry.applications.settings.SettingsConfig.reloadConfirm();
        }

        this.render();
    }

    /**
     * Exports all module settings to a JSON file
     */
    static #onExportSettings(event, target) {
        const modules = {};
        for (const s of getAllSettings()) {
            modules[s.module] ??= { version: game.modules.get(s.module)?.version ?? "", settings: {} };
            modules[s.module].settings[s.settingKey] = readSetting(s, s.default);
        }

        // Format 2: settings grouped by module. Import also accepts format 1 (`module` + flat `settings`).
        const exportPayload = {
            format: 2,
            title: "Nik's Tweaks Settings Export",
            exportedAt: new Date().toISOString(),
            exportedBy: game.user.name,
            modules
        };

        const filename = `niks-tweaks-settings-${new Date().toISOString().slice(0, 10)}.json`;
        foundry.utils.saveDataToFile(JSON.stringify(exportPayload, null, 2), "application/json", filename);
        ui.notifications.info(`Settings exported to ${filename}`);
    }

    /**
     * Prompts the user to select a JSON file to import
     */
    static #onImportSettings(event, target) {
        if (!game.user.can("SETTINGS_MODIFY")) {
            ui.notifications.error("You do not have permission to modify world settings.");
            return;
        }

        const fileInput = this.element.querySelector(".nft-file-import-input");
        if (fileInput) {
            fileInput.value = "";
            fileInput.click();
        }
    }

    /**
     * Settings of an export file, grouped by module id. Format 2 groups them itself; format 1 (Nik's DnD5e Tweaks
     * before 14.69.0) has that module's settings as one flat object. Keys that moved from Nik's DnD5e Tweaks to this
     * module are routed here, so older backups still restore them.
     * @param {object} data  Parsed export file.
     * @returns {Record<string, Record<string, any>>|null}  Null when the file isn't a settings export.
     */
    static #readExportModules(data) {
        if (!data || (typeof data !== "object")) return null;
        if ((data.format === 2) && data.modules && (typeof data.modules === "object")) {
            const modules = {};
            for (const [id, entry] of Object.entries(data.modules)) {
                if (entry?.settings && (typeof entry.settings === "object")) modules[id] = entry.settings;
            }
            return Object.keys(modules).length ? routeMovedSettings(modules) : null;
        }
        if ((data.module === SOURCE_MODULE_ID) && data.settings && (typeof data.settings === "object")) {
            return routeMovedSettings({ [SOURCE_MODULE_ID]: data.settings });
        }
        return null;
    }

    /**
     * Handles file selection for JSON import
     */
    async #onFileSelected(event) {
        if (!game.user.can("SETTINGS_MODIFY")) {
            ui.notifications.error("You do not have permission to modify world settings.");
            return;
        }

        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const rawContent = await foundry.utils.readTextFromFile(file);
            const data = JSON.parse(rawContent);

            const modules = NiksTweaksSettingsApp.#readExportModules(data);
            if (!modules) {
                ui.notifications.error("Invalid configuration file: not a Nik's Tweaks settings export.");
                return;
            }

            const keyCount = Object.values(modules).reduce((n, settings) => n + Object.keys(settings).length, 0);
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Import Settings" },
                content: `<p>Found <strong>${keyCount}</strong> settings in <em>${file.name}</em>.</p><p>Import and apply these settings to your world now?</p>`,
                modal: true
            });

            if (!confirmed) return;

            let requiresReload = false;
            let appliedCount = 0;

            const listKeys = new Set(getAllSettings().filter(s => s.list).map(s => s.key));

            for (const [moduleId, settings] of Object.entries(modules)) {
                for (const [key, rawValue] of Object.entries(settings)) {
                    // Verify setting exists in registry
                    const settingConfig = game.settings.settings.get(`${moduleId}.${key}`);
                    if (!settingConfig) continue;
                    const value = listKeys.has(`${moduleId}.${key}`) ? normalizeListValue(rawValue) : rawValue;
                    const current = game.settings.get(moduleId, key);
                    if (current !== value) {
                        await game.settings.set(moduleId, key, value);
                        appliedCount++;
                        if (settingConfig.requiresReload) requiresReload = true;
                    }
                }
            }

            ui.notifications.info(`Successfully imported ${appliedCount} settings from ${file.name}.`);
            if (requiresReload) {
                foundry.applications.settings.SettingsConfig.reloadConfirm();
            }
            this.render();
        } catch (err) {
            log("Failed to import settings file", err);
            ui.notifications.error("Failed to parse settings JSON file: " + err.message);
        }
    }
}
