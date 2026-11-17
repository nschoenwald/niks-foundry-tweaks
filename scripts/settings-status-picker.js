/**
 * Pop-out picker for the statuses shown in the Token HUD's status palette (Token HUD Condition Palette).
 * Opened from the Settings Dashboard like the list editor: Apply writes the hidden status IDs back into the
 * dashboard's hidden input, and Save Changes there stores them.
 *
 * Which statuses count as conditions (listed in their own group) comes from the setting entry:
 * `statusPicker: { isCondition: (statusId) => boolean }`.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.63.0)
 * @updated v14.0.0 (the condition check is passed in instead of imported from the condition HUD)
 * @updated v14.7.0 (built on the generic choice picker)
 */
import { NiksChoicePickerApp } from "./settings-choice-picker.js";

/**
 * Statuses that can appear in the Token HUD, in the HUD's own order (order, then name), split into conditions and
 * other effects.
 * @param {(statusId: string) => boolean} isCondition
 * @returns {object[]} Choice picker groups.
 */
function getStatusGroups(isCondition) {
    const statuses = [];
    for (const status of foundry.utils.iterateValues(CONFIG.statusEffects)) {
        if (!status?.id || (status.hud === false)) continue;
        statuses.push({
            value: status.id,
            label: game.i18n.localize(status.name ?? status.id),
            img: status.img,
            order: status.order ?? 0,
            condition: Boolean(isCondition(status.id))
        });
    }
    statuses.sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label, game.i18n.lang));
    const groups = [];
    const conditions = statuses.filter(s => s.condition);
    const others = statuses.filter(s => !s.condition);
    if (conditions.length) groups.push({ label: game.i18n.localize("DND5E.Conditions"), choices: conditions });
    if (others.length) groups.push({ label: "Other Effects", choices: others });
    return groups;
}

/**
 * ApplicationV2 window that toggles statuses between shown and hidden.
 */
export class NiksStatusPickerApp extends NiksChoicePickerApp {
    /**
     * @param {object} options  As NiksChoicePickerApp, plus:
     * @param {(statusId: string) => boolean} [options.isCondition]  Whether a status is one of the system's conditions.
     */
    constructor(options = {}) {
        const isCondition = (typeof options.isCondition === "function") ? options.isCondition : () => false;
        super({
            ...options,
            mode: "hide",
            noun: "statuses",
            resetTitle: "Hide only the default statuses (Dehydration, Malnutrition and Suffocation)",
            getGroups: () => getStatusGroups(isCondition)
        });
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        window: {
            icon: "fa-solid fa-eye-slash"
        }
    };
}
