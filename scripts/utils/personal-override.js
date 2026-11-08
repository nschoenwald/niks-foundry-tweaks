/**
 * Features whose personal setting can override the GM's world setting in both directions.
 *
 * The usual pattern (`isFeatureActive("enableX", "clientEnableX")`) needs both the world setting and the player's
 * opt-out to be on. Features that only change what happens on one player's own computer (drawing, frame rate, video
 * uploads) instead use a personal Select with three choices:
 *   - "world" (default): follow the GM's world setting
 *   - "on":  on for this player even if the GM left it off
 *   - "off": off for this player even if the GM turned it on
 *
 * The dashboard knows these from `overridesWorld: true` on the personal setting's schema entry (no "has no effect"
 * dimming when the world setting is off).
 *
 * @introduced v14.2.2
 */
import { MODULE_ID, getSetting, clearSettingsCache } from "../context.js";

/** Choices of a personal override setting, for registration (game.settings) and the schema (dashboard). */
export const OVERRIDE_CHOICES = Object.freeze({
    world: "Use World Setting",
    on: "On",
    off: "Off"
});

/** @returns {{value: string, label: string}[]} The choices in the dashboard schema format. */
export function overrideSchemaChoices() {
    return Object.entries(OVERRIDE_CHOICES).map(([value, label]) => ({ value, label }));
}

/**
 * Whether a feature is on for this user: the personal choice if it is "on" or "off", otherwise the world setting.
 * Clears both settings from the shared cache first, because it is also called from `onChange`, which can run
 * before the hooks that clear the cache.
 * @param {string} worldKey    Boolean world setting
 * @param {string} clientKey   Personal override setting ("world" | "on" | "off")
 * @returns {boolean}
 */
export function isFeatureOnForUser(worldKey, clientKey) {
    clearSettingsCache(`${MODULE_ID}.${worldKey}`);
    clearSettingsCache(`${MODULE_ID}.${clientKey}`);
    try {
        const personal = getSetting(clientKey);
        if (personal === "on") return true;
        if (personal === "off") return false;
        return Boolean(getSetting(worldKey));
    } catch {
        return false;
    }
}
