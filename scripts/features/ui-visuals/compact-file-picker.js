/**
 * Feature: Compact File Picker
 * Description: Makes Foundry's file picker resizable and less tall: tabs with the icon beside the label, the S3 bucket,
 * search and display mode buttons on one row, favorites folded to one line until hovered, upload and selected file
 * on one row, and a small tiles display mode. Remembers the window size and display mode between sessions.
 *
 * @introduced v14.10.0
 */
import { MODULE_ID, log, isFeatureActive } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";

/** Display mode id of the small tiles view, added to `FilePicker.DISPLAY_MODES`. */
export const COMPACT_TILES_MODE = "nftCompactTiles";

/** Hidden client setting holding `{ width, height, displayMode }`. */
export const STATE_SETTING = "compactFilePickerState";

const BODY_CLASS = "nft-compact-file-picker";
const FILE_PICKER = "foundry.applications.apps.FilePicker";

let _patched = false;

function _active() {
    return isFeatureActive("enableCompactFilePicker", "clientEnableCompactFilePicker");
}

function _getState() {
    try {
        return game.settings.get(MODULE_ID, STATE_SETTING) ?? {};
    } catch {
        return {};
    }
}

function _saveState(changes) {
    const state = { ..._getState(), ...changes };
    game.settings.set(MODULE_ID, STATE_SETTING, state).catch(() => {});
}

/** Called at setup and whenever one of the two settings changes. */
export function initCompactFilePicker() {
    const active = _active();
    document.body.classList.toggle(BODY_CLASS, active);
    if (!active) return;

    if (!_patched) {
        _patched = true;
        _registerPatches();
    }

    // Restore the last display mode (core only keeps it until the next reload)
    const FilePicker = foundry.applications.apps.FilePicker;
    const { displayMode } = _getState();
    if (displayMode && FilePicker.DISPLAY_MODES.includes(displayMode)) FilePicker.LAST_DISPLAY_MODE = displayMode;

    log("Compact File Picker enabled");
}

function _registerPatches() {
    const FilePicker = foundry.applications.apps.FilePicker;
    if (!FilePicker.DISPLAY_MODES.includes(COMPACT_TILES_MODE)) {
        // Insert after "tiles" so the order matches the buttons
        const i = FilePicker.DISPLAY_MODES.indexOf("tiles");
        FilePicker.DISPLAY_MODES.splice(i < 0 ? FilePicker.DISPLAY_MODES.length : i + 1, 0, COMPACT_TILES_MODE);
    }

    // Resizable, opening at the remembered size
    patchMethod(`${FILE_PICKER}.prototype._initializeApplicationOptions`, function (wrapped, ...args) {
        const options = wrapped(...args);
        if (!_active()) return options;
        options.window.resizable = true;
        const { width, height } = _getState();
        if (Number.isFinite(width)) options.position.width = width;
        if (Number.isFinite(height)) options.position.height = height;
        return options;
    }, "WRAPPER");

    // Core shrinks the window to its content after browsing and filtering (setPosition({height: "auto"})).
    // Once the window has a fixed height (resized, or opened at a remembered size), keep it.
    patchMethod(`${FILE_PICKER}.prototype.setPosition`, function (wrapped, position, ...args) {
        if (position?.height === "auto" && this.options.position.height !== "auto" && _active()) {
            position = { ...position };
            delete position.height;
        }
        return wrapped(position, ...args);
    }, "WRAPPER");

    // The small tiles mode renders core's tiles markup; a class on the window shrinks it
    patchMethod(`${FILE_PICKER}.prototype._prepareContext`, async function (wrapped, ...args) {
        const context = await wrapped(...args);
        if (context.displayMode === COMPACT_TILES_MODE) {
            if (!_active()) this.displayMode = this.constructor.LAST_DISPLAY_MODE = "tiles";
            context.displayMode = "tiles";
        }
        return context;
    }, "WRAPPER");

    patchMethod(`${FILE_PICKER}.prototype._onRender`, async function (wrapped, context, options) {
        await wrapped(context, options);
        if (!_active()) return;
        try {
            _decorate(this, options);
        } catch (err) {
            console.error(`${MODULE_ID} | Compact File Picker:`, err);
        }
    }, "WRAPPER");

    patchMethod(`${FILE_PICKER}.prototype._tearDown`, function (wrapped, ...args) {
        this._nftFavoritesObserver?.disconnect();
        return wrapped(...args);
    }, "WRAPPER");
}

/**
 * Adjust the rendered picker.
 * @param {FilePicker} app
 * @param {object} options  Render options
 */
function _decorate(app, options) {
    const el = app.element;
    el.classList.toggle("nft-compact-tiles", app.displayMode === COMPACT_TILES_MODE);

    if (options.isFirstRender) _watchResize(app);

    // Remember the display mode across reloads
    if (app.displayMode && _getState().displayMode !== app.displayMode) _saveState({ displayMode: app.displayMode });

    if (!options.parts?.includes("subheader")) return;

    // Small tiles button after core's tiles button
    const tilesButton = el.querySelector('.subheader .split-button [data-mode="tiles"]');
    if (tilesButton && !el.querySelector(`[data-mode="${COMPACT_TILES_MODE}"]`)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ui-control icon fa-solid fa-table-cells";
        button.dataset.action = "changeDisplayMode";
        button.dataset.mode = COMPACT_TILES_MODE;
        button.dataset.tooltip = "";
        button.ariaLabel = game.i18n.localize("NFT.CompactFilePicker.SmallTiles");
        tilesButton.after(button);
    }
    for (const button of el.querySelectorAll(".subheader .split-button [data-mode]")) {
        button.ariaPressed = String(button.dataset.mode === app.displayMode);
    }

    _foldFavorites(app);
}

/** Save the size when the user finishes dragging the resize handle. */
function _watchResize(app) {
    const handle = app.element.querySelector(".window-resize-handle");
    if (!handle) return;
    handle.addEventListener("pointerdown", () => {
        const doc = app.element.ownerDocument;
        doc.addEventListener("pointerup", () => {
            const { width, height } = app.position;
            if (Number.isFinite(width) && Number.isFinite(height)) {
                _saveState({ width: Math.round(width), height: Math.round(height) });
            }
        }, { once: true });
    });
}

/**
 * Favorites show one line; the rest unfolds on hover. Marks the row when tags are hidden so a chevron shows.
 * @param {FilePicker} app
 */
function _foldFavorites(app) {
    app._nftFavoritesObserver?.disconnect();
    const fields = app.element.querySelector(".subheader .set-favorite + .form-fields");
    const group = fields?.closest(".form-group");
    if (!group) return;
    group.classList.add("nft-favorites");
    const update = () => {
        const first = fields.firstElementChild;
        if (!first) {
            group.classList.remove("nft-favorites-overflow");
            return;
        }
        group.style.setProperty("--nft-favorites-line", `${first.offsetHeight}px`);
        // Wrapped tags keep their layout position while clipped, so this works folded and unfolded
        group.classList.toggle("nft-favorites-overflow", fields.lastElementChild.offsetTop > first.offsetTop + 1);
    };
    update();
    app._nftFavoritesObserver = new ResizeObserver(update);
    app._nftFavoritesObserver.observe(fields);
}
