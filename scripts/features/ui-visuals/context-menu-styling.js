/**
 * Feature: Context Menu Styling
 * Description: Color-codes destructive (Delete in red) and additive (Duplicate in green) actions in right-click context menus with full light and dark mode support.
 *
 * Extension `contextMenuStyling` (system add-ons, see api.js): `deleteLabels`, `duplicateLabels`, `violetLabels`
 * (i18n keys of the system's own menu entries) and `backgroundVars` (CSS variables to try for the menu background).
 *
 * @introduced v14.0.0 (moved from Nik's DnD5e Tweaks, added there in v14.34.0)
 * @updated v14.0.0 (system labels and background variable come from add-on extensions)
 */
import { debug, isFeatureActive } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";
import { getExtensions } from "../../settings-registry.js";

/**
 * Localized, lower-cased labels from every extension's `field` (an array of i18n keys).
 * @param {string} field
 * @returns {string[]}
 */
function _extensionLabels(field) {
    return getExtensions("contextMenuStyling")
        .flatMap(ext => Array.isArray(ext[field]) ? ext[field] : [])
        .map(key => (game.i18n?.localize(key) || "").toLowerCase());
}

/**
 * Initialize Context Menu Styling patch.
 *
 * Wraps `foundry.applications.ux.ContextMenu.prototype._onRenderEntries`,
 * `_setFixedPosition`, and `_onRender` to detect actions and dynamically
 * adapt styling to the menu's actual rendered background luminance.
 */
export function initContextMenuStyling() {
    // 1. Tag menu items as they are rendered into the menu DOM
    patchMethod(
        "foundry.applications.ux.ContextMenu.prototype._onRenderEntries",
        async function(wrapped, menu, options = {}) {
            await wrapped(menu, options);

            try {
                if (!isFeatureActive("enableContextMenuStyling", "clientEnableContextMenuStyling")) return;
                _applyContextMenuStyling(this, menu);
            } catch (err) {
                console.error("Nik's Foundry Tweaks | Error applying context menu styling:", err);
            }
        },
        "WRAPPER"
    );

    // 2. Once placed in the DOM via setFixedPosition, measure background luminance
    patchMethod(
        "foundry.applications.ux.ContextMenu.prototype._setFixedPosition",
        function(wrapped, menu, target, options = {}) {
            const result = wrapped(menu, target, options);
            try {
                if (isFeatureActive("enableContextMenuStyling", "clientEnableContextMenuStyling")) {
                    _updateMenuTheme(menu);
                }
            } catch (err) {
                console.error("Nik's Foundry Tweaks | Error updating context menu theme after positioning:", err);
            }
            return result;
        },
        "WRAPPER"
    );

    // 3. Fallback verification after animation / full render if not yet measured
    patchMethod(
        "foundry.applications.ux.ContextMenu.prototype._onRender",
        async function(wrapped, options = {}) {
            await wrapped(options);
            try {
                if (isFeatureActive("enableContextMenuStyling", "clientEnableContextMenuStyling")) {
                    const menuEl = this.element;
                    if (menuEl && !menuEl.dataset.nftThemeMeasured) {
                        _updateMenuTheme(menuEl);
                    }
                }
            } catch (err) {
                console.error("Nik's Foundry Tweaks | Error verifying context menu theme in onRender:", err);
            }
        },
        "WRAPPER"
    );

    debug("Context Menu Styling | Initialized");
}

let _cachedContextTerms = null;
const _cssColorCache = new Map();

/**
 * Lazily resolve and cache comparison action terms.
 * @returns {{deleteTerms: Set<string>, duplicateTerms: Set<string>, violetTerms: Set<string>}}
 */
function _getContextTerms() {
    if (_cachedContextTerms) return _cachedContextTerms;

    const deleteTerms = new Set([
        "delete",
        "remove",
        (game.i18n?.localize("SIDEBAR.Delete") || "").toLowerCase(),
        (game.i18n?.localize("DOCUMENT.Delete") || "").toLowerCase(),
        ..._extensionLabels("deleteLabels")
    ].filter(Boolean));

    const duplicateTerms = new Set([
        "duplicate",
        "copy",
        "clone",
        (game.i18n?.localize("SIDEBAR.Duplicate") || "").toLowerCase(),
        (game.i18n?.localize("DOCUMENT.Duplicate") || "").toLowerCase(),
        (game.i18n?.localize("COMPENDIUM.Duplicate.Option") || "").toLowerCase(),
        ..._extensionLabels("duplicateLabels")
    ].filter(Boolean));

    const violetTerms = new Set([
        "make private",
        "reveal to everyone",
        "reveal message",
        "conceal message",
        "conceal",
        "private",
        (game.i18n?.localize("CHAT.RevealMessage") || "").toLowerCase(),
        (game.i18n?.localize("CHAT.ConcealMessage") || "").toLowerCase(),
        ..._extensionLabels("violetLabels")
    ].filter(Boolean));

    _cachedContextTerms = { deleteTerms, duplicateTerms, violetTerms };
    return _cachedContextTerms;
}

/**
 * Resolves a CSS color/variable string using a cached DOM probe.
 * @param {string} varString
 * @returns {string}
 */
function _resolveCssColor(varString) {
    if (_cssColorCache.has(varString)) return _cssColorCache.get(varString);
    const probe = document.createElement("div");
    probe.style.color = varString;
    document.body.appendChild(probe);
    const resolved = window.getComputedStyle(probe).color;
    probe.remove();
    _cssColorCache.set(varString, resolved);
    return resolved;
}

/**
 * Scan and tag Delete and Duplicate actions in the rendered context menu.
 *
 * @param {foundry.applications.ux.ContextMenu} contextMenu
 * @param {HTMLMenuElement} menu
 */
function _applyContextMenuStyling(contextMenu, menu) {
    if (!menu) return;

    const { deleteTerms, duplicateTerms, violetTerms } = _getContextTerms();

    // 1. Tag based on menuItems metadata if available
    if (Array.isArray(contextMenu.menuItems)) {
        for (const item of contextMenu.menuItems) {
            const el = item.element;
            if (!el) continue;

            const labelKey = (item.label ?? item.name ?? "").toLowerCase();
            const iconClass = (typeof item.icon === "string" ? item.icon : "").toLowerCase();
            const text = (el.querySelector("span")?.textContent ?? "").trim().toLowerCase();

            if (_isDeleteAction(labelKey, iconClass, text, deleteTerms)) {
                el.classList.add("nft-context-delete");
                el.dataset.nftAction = "delete";
            } else if (_isDuplicateAction(labelKey, iconClass, text, duplicateTerms)) {
                el.classList.add("nft-context-duplicate");
                el.dataset.nftAction = "duplicate";
            } else if (_isVioletAction(labelKey, iconClass, text, violetTerms)) {
                el.classList.add("nft-context-violet");
                el.dataset.nftAction = "violet";
            }
        }
    }

    // 2. Fallback scan on any rendered .context-item in the DOM not yet tagged
    for (const el of menu.querySelectorAll(".context-item:not([data-nft-action])")) {
        const iconEl = el.querySelector("i, [class*='fa-']");
        const iconClass = (iconEl?.className ?? "").toLowerCase();
        const text = (el.querySelector("span")?.textContent ?? el.textContent ?? "").trim().toLowerCase();

        if (_isDeleteAction("", iconClass, text, deleteTerms)) {
            el.classList.add("nft-context-delete");
            el.dataset.nftAction = "delete";
        } else if (_isDuplicateAction("", iconClass, text, duplicateTerms)) {
            el.classList.add("nft-context-duplicate");
            el.dataset.nftAction = "duplicate";
        } else if (_isVioletAction("", iconClass, text, violetTerms)) {
            el.classList.add("nft-context-violet");
            el.dataset.nftAction = "violet";
        }
    }
}

/**
 * Dynamically detects the actual background luminance of the rendered context menu
 * and applies `.nft-theme-dark` or `.nft-theme-light` to ensure action text colors
 * always have high contrast against the actual background.
 *
 * @param {HTMLElement} menuEl - The `<nav id="context-menu">` element.
 */
function _updateMenuTheme(menuEl) {
    if (!menuEl || !menuEl.isConnected) return;
    if (menuEl.dataset.nftThemeMeasured) return;

    const isDark = _isMenuBackgroundDark(menuEl);

    menuEl.classList.toggle("nft-theme-dark", isDark);
    menuEl.classList.toggle("nft-theme-light", !isDark);
    menuEl.dataset.nftThemeMeasured = "true";
}

/**
 * Determines whether the rendered context menu element has a dark background.
 *
 * @param {HTMLElement} menuEl
 * @returns {boolean}
 */
function _isMenuBackgroundDark(menuEl) {
    const computed = window.getComputedStyle(menuEl);
    let bg = computed.backgroundColor;

    // If transparent, inspect CSS variables assigned to the element
    if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") {
        const extraVars = getExtensions("contextMenuStyling").flatMap(ext => ext.backgroundVars ?? []);
        const bgVar = ["--background-color", ...extraVars]
            .map(name => computed.getPropertyValue(name).trim())
            .find(Boolean);
        if (bgVar) {
            bg = _resolveCssColor(bgVar);
        }
    }

    // Parse RGBA values
    const rgbMatch = bg?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);
        const a = rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1;

        if (a > 0.1) {
            // Standard relative luminance (ITU-R BT.709)
            const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            return luminance < 0.5;
        }
    }

    // Fallback: check if body is theme-dark or if theme-dark is active
    return !document.body.classList.contains("theme-light");
}

/**
 * Check if an item represents a Delete/Remove action.
 *
 * @param {string} labelKey
 * @param {string} iconClass
 * @param {string} text
 * @param {Set<string>} deleteTerms
 * @returns {boolean}
 */
function _isDeleteAction(labelKey, iconClass, text, deleteTerms) {
    if (labelKey.includes("delete") || labelKey.includes("remove")) return true;
    if (iconClass.includes("fa-trash") || iconClass.includes("fa-trash-can") || iconClass.includes("fa-trash-alt")) return true;
    if (deleteTerms.has(text)) return true;
    for (const term of deleteTerms) {
        if (text.startsWith(term) || text.endsWith(term)) return true;
    }
    return false;
}

/**
 * Check if an item represents a Duplicate/Copy/Clone action.
 *
 * @param {string} labelKey
 * @param {string} iconClass
 * @param {string} text
 * @param {Set<string>} duplicateTerms
 * @returns {boolean}
 */
function _isDuplicateAction(labelKey, iconClass, text, duplicateTerms) {
    if (labelKey.includes("duplicate") || labelKey.includes("clone") || labelKey.includes("copy")) return true;
    if (iconClass.includes("fa-copy") || iconClass.includes("fa-clone")) return true;
    if (duplicateTerms.has(text)) return true;
    for (const term of duplicateTerms) {
        if (text.startsWith(term) || text.endsWith(term)) return true;
    }
    return false;
}

/**
 * Check if an item represents a Make Private / Reveal action.
 *
 * @param {string} labelKey
 * @param {string} iconClass
 * @param {string} text
 * @param {Set<string>} violetTerms
 * @returns {boolean}
 */
function _isVioletAction(labelKey, iconClass, text, violetTerms) {
    if (labelKey.includes("revealmessage") || labelKey.includes("concealmessage")) return true;
    if (labelKey === "chat.revealmessage" || labelKey === "chat.concealmessage") return true;
    if (labelKey.includes("reveal") && !labelKey.includes("table")) return true;
    if (labelKey.includes("conceal") || labelKey.includes("private")) return true;
    if (violetTerms.has(text) || violetTerms.has(labelKey)) return true;
    for (const term of violetTerms) {
        if (text === term || text.startsWith(term) || text.endsWith(term) || text.includes(term)) return true;
        if (labelKey === term || labelKey.startsWith(term) || labelKey.endsWith(term)) return true;
    }
    return false;
}

