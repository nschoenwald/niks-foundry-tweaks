/**
 * This module's context: id, logging and cached setting helpers for every feature file.
 * Feature files import from here, never from `main.js`.
 *
 * @introduced v14.0.0
 */
import { createContext } from "./utils/create-context.js";

export const {
    MODULE_ID,
    log,
    debug,
    getSetting,
    isFeatureActive,
    clearSettingsCache
} = createContext({ moduleId: "niks-foundry-tweaks", label: "Nik's Foundry Tweaks" });
