/**
 * Feature: Carolingian UI Theme Harmony
 * Description: Dynamically harmonizes Nik's Tweaks styling and features with Carolingian UI (crlngn-ui),
 * adopting its active color themes, layout offsets, and combat carousel aesthetics.
 *
 * Extension `carolingianHarmony` (system add-ons, see api.js): `combatantClass(combatant)` returns a class to add
 * to that combatant's row in the combat tracker and carousel (e.g. dnd5e's legendary action placeholders), or null.
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.37.0)
 * @updated v14.0.0 (combatant tagging comes from add-on extensions)
 */
import { log, debug, isFeatureActive } from "../../context.js";
import { getExtensions } from "../../settings-registry.js";

const CRLNGN_MODULE_ID = "crlngn-ui";
const HARMONY_BODY_CLASS = "nft-crlngn-theme-active";

/**
 * Checks whether Carolingian UI is installed and active in the world.
 * @returns {boolean}
 */
export function isCarolingianActive() {
    return Boolean(game.modules?.get(CRLNGN_MODULE_ID)?.active);
}

/**
 * Checks whether Carolingian UI Theme Harmony should be applied to the current client.
 * Requires Carolingian UI to be installed and active, plus both world and personal client settings enabled.
 * @returns {boolean}
 */
export function isCarolingianHarmonyActive() {
    if (!isCarolingianActive()) return false;
    return isFeatureActive("enableCarolingianTheme", "clientEnableCarolingianTheme");
}

/**
 * Applies or removes the harmony class on a document body.
 * @param {Document} doc
 * @param {boolean} active
 */
function _applyClassToDocument(doc, active) {
    if (!doc?.body) return;
    doc.body.classList.toggle(HARMONY_BODY_CLASS, active);
}

/**
 * Updates the Carolingian UI harmony class across the main window and any detached popout windows.
 */
export function updateCarolingianThemeState() {
    const active = isCarolingianHarmonyActive();

    // Main window
    _applyClassToDocument(document, active);

    // Detached popout windows
    const detachedWindows = foundry.applications?.detached?.values?.() ?? [];
    for (const win of detachedWindows) {
        if (win?.document) {
            _applyClassToDocument(win.document, active);
        }
    }
}

/**
 * Classes add-ons want on a combatant's row.
 * @param {Combatant} combatant
 * @returns {string[]}
 */
function _combatantClasses(combatant) {
    const classes = [];
    for (const ext of getExtensions("carolingianHarmony")) {
        if (typeof ext.combatantClass !== "function") continue;
        try {
            const cls = ext.combatantClass(combatant);
            if (cls) classes.push(cls);
        } catch (err) {
            debug("Carolingian UI Theme Harmony: extension combatantClass failed", err);
        }
    }
    return classes;
}

/**
 * Tags combatant elements in the combat tracker and carousel with the classes add-ons ask for.
 * @param {Application} app
 * @param {HTMLElement|JQuery} html
 */
function _tagPlaceholderCombatants(app, html) {
    if (!isCarolingianHarmonyActive()) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    const combat = app.viewed;
    if (!combat || !getExtensions("carolingianHarmony").length) return;

    const combatantElements = root.querySelectorAll("li.combatant[data-combatant-id]");
    for (const el of combatantElements) {
        const id = el.dataset.combatantId;
        const combatant = combat.combatants.get(id);
        if (!combatant) continue;
        const classes = _combatantClasses(combatant);
        if (classes.length) el.classList.add(...classes);
    }
}

/**
 * Initializes Carolingian UI Theme Harmony.
 */
export function initCarolingianHarmony() {
    if (!isCarolingianActive()) return;

    // Apply initial state
    updateCarolingianThemeState();

    // Hook into combat tracker and combat popout renders
    Hooks.on("renderCombatTracker", (app, html) => {
        _tagPlaceholderCombatants(app, html);
    });

    // Tag popout windows when rendered
    Hooks.on("renderApplicationV2", (app) => {
        if (app.element?.ownerDocument && app.element.ownerDocument !== document) {
            _applyClassToDocument(app.element.ownerDocument, isCarolingianHarmonyActive());
        }
    });

    // Re-verify on ready once all modules and UI layers are fully set up
    Hooks.once("ready", () => {
        updateCarolingianThemeState();
    });

    log("Carolingian UI Theme Harmony initialized");
}
