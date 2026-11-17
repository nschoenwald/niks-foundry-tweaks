/**
 * Pop-out picker for list settings whose entries come from a known set of options (statuses, languages, …).
 * Opened from the Settings Dashboard like the list editor: Apply writes the chosen values back into the
 * dashboard's hidden input, and Save Changes there stores them.
 *
 * A setting entry opts in with `list: true` plus
 * ```js
 * choicePicker: {
 *     // Options, in groups. A group or choice with children lists them indented below it.
 *     getGroups: () => [{ label, value?, choices: [{ value, label, img?, children?: [...] }] }],
 *     // "hide": stored values are hidden things (eye icons). "select": stored values are picked things (checkboxes).
 *     // A function gets `readValue(settingKey)` for the dashboard's current (unsaved) value of a sibling setting.
 *     mode?: "hide" | "select" | ((readValue) => "hide" | "select"),
 *     // Map a stored entry (e.g. one typed by hand) to an option value; null keeps it as it is.
 *     normalize?: (entry) => string|null,
 *     noun?: "languages"  // used in labels ("Search languages…")
 * }
 * ```
 * A group with a `value` can be picked as a whole; options under a picked group or option are shown as included.
 * Stored entries that match no option are kept unchanged.
 *
 * Add-ons: on cores older than 14.7.0 the setting falls back to the plain list editor.
 *
 * @introduced v14.7.0 (generalized from the Token HUD status picker)
 */
import { parseListValue } from "./settings-list-editor.js";

/**
 * ApplicationV2 window that toggles options of a list setting on and off.
 */
export class NiksChoicePickerApp extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /**
     * @param {object} options
     * @param {string} options.settingKey            Setting key being edited (unique id part).
     * @param {string} options.settingName           Display name for the window title.
     * @param {string} [options.hint]                Hint shown above the list.
     * @param {string} options.value                 Current comma-separated values.
     * @param {string} [options.defaultValue]        Default comma-separated values for "Reset to Default".
     * @param {(value: string) => void} options.onApply  Receives the comma-separated values on Apply.
     * @param {() => object[]} options.getGroups     Option groups (see the file header).
     * @param {"hide"|"select"} [options.mode="hide"]
     * @param {(entry: string) => string|null} [options.normalize]
     * @param {string} [options.noun="entries"]
     * @param {string} [options.resetTitle]          Tooltip of "Reset to Default".
     */
    constructor(options = {}) {
        super({ ...options, id: `nft-choice-picker-${options.settingKey}` });
        this.#settingName = options.settingName;
        this.#hint = options.hint ?? "";
        this.#getGroups = (typeof options.getGroups === "function") ? options.getGroups : () => [];
        this.#mode = (options.mode === "select") ? "select" : "hide";
        this.#normalize = (typeof options.normalize === "function") ? options.normalize : () => null;
        this.#noun = options.noun || "entries";
        this.#resetTitle = options.resetTitle ?? "Restore the default list";
        this.#active = new Set(this.#normalizeList(options.value));
        this.#defaultActive = this.#normalizeList(options.defaultValue);
        this.#onApply = options.onApply;
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["nft-settings-app", "nft-list-editor", "nft-status-picker", "nft-choice-picker"],
        tag: "div",
        window: {
            icon: "fa-solid fa-list-check",
            resizable: true
        },
        position: {
            width: 460,
            height: 600
        },
        actions: {
            toggleChoice: NiksChoicePickerApp.#onToggleChoice,
            clearChoices: NiksChoicePickerApp.#onClearChoices,
            resetChoices: NiksChoicePickerApp.#onResetChoices,
            applyChoices: NiksChoicePickerApp.#onApplyChoices,
            close: function() { return this.close(); }
        }
    };

    /** @override */
    static PARTS = {
        picker: {
            template: "modules/niks-foundry-tweaks/templates/settings-choice-picker.hbs",
            scrollable: [".nft-status-picker-groups"]
        }
    };

    /** @type {string} */
    #settingName;

    /** @type {string} */
    #hint;

    /** @type {() => object[]} */
    #getGroups;

    /** @type {"hide"|"select"} */
    #mode;

    /** @type {(entry: string) => string|null} */
    #normalize;

    /** @type {string} */
    #noun;

    /** @type {string} */
    #resetTitle;

    /** @type {Set<string>} Stored values, including ones that match no option (kept as they were). */
    #active;

    /** @type {string[]} */
    #defaultActive;

    /** @type {(value: string) => void} */
    #onApply;

    /** @override */
    get title() {
        return `Choose: ${this.#settingName}`;
    }

    /** Whether stored values mean "hidden". */
    get isHideMode() {
        return this.#mode === "hide";
    }

    /**
     * Split a stored list and map each entry to an option value where possible.
     * @param {string} value
     * @returns {string[]}
     */
    #normalizeList(value) {
        return parseListValue(String(value ?? "")).map(entry => {
            try {
                return this.#normalize(entry) ?? entry;
            } catch {
                return entry;
            }
        });
    }

    /** @override */
    async _prepareContext(options) {
        const hide = this.isHideMode;
        return {
            hint: this.#hint,
            noun: this.#noun,
            clearIcon: hide ? "fa-eye" : "fa-square",
            clearLabel: hide ? "Show All" : "Clear",
            clearTitle: hide ? `Show all ${this.#noun}` : `Uncheck all ${this.#noun}`,
            resetTitle: this.#resetTitle
        };
    }

    /** @override */
    _onRender(context, options) {
        const input = this.element.querySelector(".nft-list-editor-input");
        input?.addEventListener("input", () => this.#renderChoices());
        this.#renderChoices();
        input?.focus();
    }

    /**
     * Groups with their choices flattened (children indented), each knowing its ancestors.
     * @returns {{label: string, value: string|null, choices: {value: string, label: string, img?: string, depth: number, ancestors: string[], hasChildren: boolean}[]}[]}
     */
    #flatGroups() {
        let groups = [];
        try {
            groups = this.#getGroups() ?? [];
        } catch (err) {
            console.error("niks-foundry-tweaks | Choice picker options failed:", err);
        }
        return groups.map(group => {
            const value = group.value ?? null;
            const choices = [];
            const walk = (list, depth, ancestors) => {
                for (const choice of list ?? []) {
                    if (!choice?.value) continue;
                    choices.push({
                        value: choice.value, label: choice.label ?? choice.value, img: choice.img, depth, ancestors,
                        hasChildren: Boolean(choice.children?.length)
                    });
                    if (choice.children?.length) walk(choice.children, depth + 1, [...ancestors, choice.value]);
                }
            };
            walk(group.choices, 0, value ? [value] : []);
            return { label: group.label ?? "", value, choices };
        });
    }

    /**
     * Rebuild the option rows, filtered by the search text.
     */
    #renderChoices() {
        const root = this.element;
        if (!root) return;
        const doc = root.ownerDocument;
        const hide = this.isHideMode;
        const query = (root.querySelector(".nft-list-editor-input")?.value ?? "").trim().toLocaleLowerCase();
        const groups = this.#flatGroups();
        const labels = new Map();
        for (const group of groups) {
            if (group.value) labels.set(group.value, group.label);
            for (const choice of group.choices) labels.set(choice.value, choice.label);
        }

        const icon = (active, covered) => {
            if (hide) return (active || covered) ? "fa-eye-slash" : "fa-eye";
            if (active) return "fa-square-check";
            return covered ? "fa-square-check" : "fa-square";
        };

        const buildToggle = ({ value, label, img, depth = 0, ancestors = [] }, isGroup = false) => {
            const active = this.#active.has(value);
            const coveredBy = ancestors.find(a => this.#active.has(a));
            const covered = !active && Boolean(coveredBy);
            const row = doc.createElement("button");
            row.type = "button";
            row.className = isGroup ? "nft-status-pick nft-choice-pick-group" : "nft-status-pick";
            row.classList.toggle("active-choice", active);
            row.classList.toggle("covered-choice", covered);
            row.classList.toggle("hidden-status", hide && (active || covered));
            row.classList.toggle("select-mode", !hide);
            if (depth) row.style.setProperty("--nft-choice-depth", depth);
            row.dataset.action = "toggleChoice";
            row.dataset.value = value;
            row.setAttribute("aria-pressed", active ? "true" : "false");
            const via = covered ? ` (included through ${labels.get(coveredBy) ?? coveredBy})` : "";
            const what = isGroup ? `all of ${label}` : label;
            if (hide) row.title = active ? `Hidden. Click to show ${what}.` : `${covered ? "Hidden" : "Shown"}${via}. Click to hide ${what}.`;
            else row.title = active ? `Checked. Click to uncheck ${what}.` : `${covered ? "Checked" : "Unchecked"}${via}. Click to check ${what}.`;

            if (img) {
                const image = doc.createElement("img");
                image.src = img;
                image.alt = "";
                row.append(image);
            }
            const name = doc.createElement("span");
            name.className = "nft-list-editor-name";
            name.textContent = isGroup ? `All ${label}` : label;
            const mark = doc.createElement("i");
            mark.className = `fa-solid ${icon(active, covered)} nft-status-pick-eye`;
            mark.setAttribute("inert", "");
            row.append(name, mark);
            return row;
        };

        const sections = [];
        let total = 0;
        let visibleCount = 0;
        for (const group of groups) {
            total += group.choices.length;
            const matches = query
                ? group.choices.filter(c => c.label.toLocaleLowerCase().includes(query))
                : group.choices;
            if (!matches.length) continue;
            visibleCount += matches.length;
            const section = doc.createElement("section");
            section.className = "nft-status-picker-group";
            const heading = doc.createElement("h4");
            heading.textContent = group.label;
            const grid = doc.createElement("div");
            grid.className = "nft-status-picker-grid";
            if (group.value && !query) grid.append(buildToggle({ value: group.value, label: group.label }, true));
            if (query) grid.append(...matches.map(c => buildToggle(c)));
            else {
                // An option with children gets a full-width block, so its children stay together below it
                let branch = null;
                for (const choice of matches) {
                    if (branch && (choice.depth <= branch.depth)) branch = null;
                    const row = buildToggle(choice);
                    if (branch) branch.element.append(row);
                    else if (choice.hasChildren) {
                        const element = doc.createElement("div");
                        element.className = "nft-choice-branch";
                        element.append(row);
                        grid.append(element);
                        branch = { depth: choice.depth, element };
                    } else grid.append(row);
                }
            }
            section.append(heading, grid);
            sections.push(section);
        }
        root.querySelector(".nft-status-picker-groups").replaceChildren(...sections);

        const activeCount = this.#active.size;
        root.querySelector(".nft-list-editor-count").textContent = hide
            ? `${activeCount} hidden`
            : `${activeCount} checked`;
        const empty = root.querySelector(".nft-list-editor-empty");
        empty.hidden = visibleCount > 0;
        const emptyText = empty.querySelector("p");
        if (emptyText) emptyText.textContent = total ? `No ${this.#noun} match your search.` : `No ${this.#noun} available.`;
    }

    /**
     * @this {NiksChoicePickerApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onToggleChoice(event, target) {
        const value = target.dataset.value;
        if (!value) return;
        if (this.#active.has(value)) this.#active.delete(value);
        else this.#active.add(value);
        this.#renderChoices();
    }

    /** @this {NiksChoicePickerApp} */
    static #onClearChoices() {
        this.#active.clear();
        this.#renderChoices();
    }

    /** @this {NiksChoicePickerApp} */
    static #onResetChoices() {
        this.#active = new Set(this.#defaultActive);
        this.#renderChoices();
    }

    /** @this {NiksChoicePickerApp} */
    static #onApplyChoices() {
        this.#onApply?.(parseListValue(Array.from(this.#active).join(", ")).join(", "));
        this.close();
    }
}
