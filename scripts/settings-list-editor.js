/**
 * Pop-out editor for comma-separated free-text list settings in the Settings Dashboard
 * (e.g. Self Effect Application's Auto-Apply Effects). Entries are added, searched and
 * removed individually instead of editing one long text field.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.49.1)
 * @updated v14.4.0 (Optional dropdown per entry: settings with `listChoices` store entries as "name" or "name=choice")
 */

/**
 * Split a list entry into its name and its choice ("Ice Storm=casterTurnEnd" → name "Ice Storm", choice
 * "casterTurnEnd"). Entries without "=" have no choice (the setting's default applies).
 *
 * @param {string} entry
 * @returns {{name: string, choice: string|null}}
 */
export function splitListEntry(entry) {
    const text = String(entry ?? "").trim();
    const index = text.lastIndexOf("=");
    if (index <= 0) return { name: text, choice: null };
    const choice = text.slice(index + 1).trim();
    return { name: text.slice(0, index).trim(), choice: choice || null };
}

/**
 * Split a comma-separated list into trimmed entries, dropping empty entries and
 * case-insensitive duplicates (by name, first spelling wins), sorted alphabetically by name (case-insensitive).
 *
 * @param {string} value
 * @returns {string[]}
 */
export function parseListValue(value) {
    if (typeof value !== "string") return [];
    const seen = new Set();
    const entries = [];
    for (const raw of value.split(",")) {
        const entry = raw.trim();
        const key = splitListEntry(entry).name.toLocaleLowerCase();
        if (!entry || !key || seen.has(key)) continue;
        seen.add(key);
        entries.push(entry);
    }
    const nameOf = e => splitListEntry(e).name;
    return entries.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" }));
}

/**
 * Normalize a comma-separated free-text list: trims entries, drops empty entries and
 * case-insensitive duplicates, and sorts alphabetically (case-insensitive).
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeListValue(value) {
    if (typeof value !== "string") return value;
    return parseListValue(value).join(", ");
}

/**
 * ApplicationV2 window that edits one list setting and hands the result back to the dashboard.
 */
export class NiksListEditorApp extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /**
     * @param {object} options
     * @param {string} options.settingKey            Setting key being edited.
     * @param {string} options.settingName           Display name for the window title.
     * @param {string} [options.hint]                Hint shown above the list.
     * @param {string} options.value                 Current comma-separated value.
     * @param {string} [options.defaultValue]        Default comma-separated value for "Reset to Default".
     * @param {{value: string, label: string}[]} [options.choices]  Dropdown shown next to every entry.
     * @param {string} [options.choiceDefault]       Choice of entries without one (stored as the bare name).
     * @param {(value: string) => void} options.onApply  Receives the normalized value on Apply.
     */
    constructor(options = {}) {
        super({ ...options, id: `nft-list-editor-${options.settingKey}` });
        this.#settingKey = options.settingKey;
        this.#settingName = options.settingName;
        this.#hint = options.hint ?? "";
        this.#entries = parseListValue(options.value ?? "");
        this.#defaultEntries = parseListValue(options.defaultValue ?? "");
        this.#choices = Array.isArray(options.choices) && options.choices.length ? options.choices : null;
        this.#choiceDefault = options.choiceDefault ?? this.#choices?.[0]?.value ?? null;
        this.#onApply = options.onApply;
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["nft-settings-app", "nft-list-editor"],
        tag: "div",
        window: {
            icon: "fa-solid fa-list",
            resizable: true
        },
        position: {
            width: 420,
            height: 560
        },
        actions: {
            addEntry: NiksListEditorApp.#onAddEntry,
            removeEntry: NiksListEditorApp.#onRemoveEntry,
            resetEntries: NiksListEditorApp.#onResetEntries,
            applyEntries: NiksListEditorApp.#onApplyEntries,
            close: function() { return this.close(); }
        }
    };

    /** @override */
    static PARTS = {
        editor: {
            template: "modules/niks-foundry-tweaks/templates/settings-list-editor.hbs",
            scrollable: [".nft-list-editor-entries"]
        }
    };

    /** @type {string} */
    #settingKey;

    /** @type {string} */
    #settingName;

    /** @type {string} */
    #hint;

    /** @type {string[]} Current entries, always sorted. */
    #entries;

    /** @type {string[]} */
    #defaultEntries;

    /** @type {{value: string, label: string}[]|null} */
    #choices;

    /** @type {string|null} */
    #choiceDefault;

    /** @type {(value: string) => void} */
    #onApply;

    /** @type {string} Entry to briefly highlight after it was added or matched. */
    #highlight = "";

    /** @override */
    get title() {
        return `Edit List: ${this.#settingName}`;
    }

    /** @override */
    async _prepareContext(options) {
        return { hint: this.#hint };
    }

    /** @override */
    _onRender(context, options) {
        const input = this.#input;
        input?.addEventListener("input", () => this.#renderEntries());
        input?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            this.#addFromInput();
        });
        // Entry dropdowns (settings with choices): store the bare name for the default choice
        this.element?.querySelector(".nft-list-editor-entries")?.addEventListener("change", (event) => {
            const select = event.target.closest?.(".nft-list-editor-choice");
            if (!select) return;
            const index = this.#entries.indexOf(select.dataset.entry);
            if (index < 0) return;
            const { name } = splitListEntry(select.dataset.entry);
            const entry = (select.value === this.#choiceDefault) ? name : `${name}=${select.value}`;
            this.#entries[index] = entry;
            select.dataset.entry = entry;
            select.closest(".nft-list-editor-entry")?.querySelector(".nft-list-editor-remove")?.setAttribute("data-entry", entry);
        });
        this.#renderEntries();
        input?.focus();
    }

    /** @returns {HTMLInputElement|null} */
    get #input() {
        return this.element?.querySelector(".nft-list-editor-input") ?? null;
    }

    /**
     * Rebuild the entry rows, filtered by the current input text.
     */
    #renderEntries() {
        const root = this.element;
        if (!root) return;
        const listEl = root.querySelector(".nft-list-editor-entries");
        const countEl = root.querySelector(".nft-list-editor-count");
        const emptyEl = root.querySelector(".nft-list-editor-empty");
        const query = (this.#input?.value ?? "").trim().toLocaleLowerCase();

        // Several comma-separated entries in the input are an "add" in progress, not a filter.
        const filter = query.includes(",") ? "" : query;
        const visible = filter
            ? this.#entries.filter(e => splitListEntry(e).name.toLocaleLowerCase().includes(filter))
            : this.#entries;

        const doc = root.ownerDocument;
        listEl.replaceChildren(...visible.map(entry => {
            const li = doc.createElement("li");
            li.className = "nft-list-editor-entry";
            if (entry === this.#highlight) li.classList.add("highlight");

            const parts = splitListEntry(entry);
            const name = doc.createElement("span");
            name.className = "nft-list-editor-name";
            name.textContent = this.#choices ? parts.name : entry;
            name.title = name.textContent;

            const remove = doc.createElement("button");
            remove.type = "button";
            remove.className = "nft-list-editor-remove";
            remove.dataset.action = "removeEntry";
            remove.dataset.entry = entry;
            remove.title = `Remove ${entry}`;
            remove.setAttribute("aria-label", `Remove ${entry}`);
            remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';

            if (this.#choices) {
                const select = doc.createElement("select");
                select.className = "nft-select nft-list-editor-choice";
                select.dataset.entry = entry;
                select.setAttribute("aria-label", `${parts.name}: ${this.#settingName}`);
                const current = parts.choice ?? this.#choiceDefault;
                for (const choice of this.#choices) {
                    const option = doc.createElement("option");
                    option.value = choice.value;
                    option.textContent = choice.label;
                    option.selected = choice.value === current;
                    select.append(option);
                }
                li.append(name, select, remove);
            } else li.append(name, remove);
            return li;
        }));

        const total = this.#entries.length;
        countEl.textContent = filter
            ? `${visible.length} of ${total} ${total === 1 ? "entry" : "entries"}`
            : `${total} ${total === 1 ? "entry" : "entries"}`;

        emptyEl.hidden = visible.length > 0;
        emptyEl.querySelector("p").textContent = total
            ? "No entries match your search. Press Enter to add it."
            : "The list is empty. Type a name above and press Enter to add it.";

        listEl.querySelector(".highlight")?.scrollIntoView({ block: "nearest" });
    }

    /**
     * Add every comma-separated entry from the input field.
     */
    #addFromInput() {
        const input = this.#input;
        const added = parseListValue(input?.value ?? "");
        if (!added.length) return;

        const keyOf = e => splitListEntry(e).name.toLocaleLowerCase();
        const existing = new Map(this.#entries.map(e => [keyOf(e), e]));
        let last = "";
        for (const entry of added) {
            const match = existing.get(keyOf(entry));
            if (match) {
                last = match;
                continue;
            }
            this.#entries.push(entry);
            existing.set(keyOf(entry), entry);
            last = entry;
        }
        this.#entries = parseListValue(this.#entries.join(","));
        this.#highlight = last;
        input.value = "";
        this.#renderEntries();
        input.focus();
    }

    /**
     * @this {NiksListEditorApp}
     */
    static #onAddEntry() {
        this.#addFromInput();
    }

    /**
     * @this {NiksListEditorApp}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onRemoveEntry(event, target) {
        const entry = target.dataset.entry;
        this.#entries = this.#entries.filter(e => e !== entry);
        if (this.#highlight === entry) this.#highlight = "";
        this.#renderEntries();
    }

    /**
     * @this {NiksListEditorApp}
     */
    static #onResetEntries() {
        this.#entries = [...this.#defaultEntries];
        this.#highlight = "";
        if (this.#input) this.#input.value = "";
        this.#renderEntries();
    }

    /**
     * @this {NiksListEditorApp}
     */
    static #onApplyEntries() {
        this.#onApply?.(this.#entries.join(", "));
        return this.close();
    }
}
