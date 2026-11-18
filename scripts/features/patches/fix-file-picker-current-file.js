/**
 * Feature: File Picker Current File Patch
 * Description: Fixes an upstream Foundry V14 core bug where the file picker never highlights the file that is currently
 * set (e.g. a token's image) when it opens.
 *
 * @introduced v14.11.0
 */
import { log } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";

/**
 * Fix: File Picker Doesn't Mark the Current File
 * ---------------------------------------------------------------------------
 * `FilePicker#_onRender` flags the current pick with
 * `form.querySelector(`.file[data-path="${encodeURIComponent(this.request)}"]`)`, but the rows' `data-path` holds
 * the path as the server returned it (`worlds/x/token.webp`, or a full S3 URL), while `encodeURIComponent` turns every
 * `/` into `%2F`. Any file in a folder therefore never matches, and nothing is highlighted.
 *
 * After core's `_onRender`, this marks the row whose path matches the file in the "Selected" field (the file the
 * picker was opened with, or the one picked since), comparing URI-decoded paths, and scrolls it into view the first
 * time it shows up in a folder. Clicking another file moves the mark as before (core's `#onPickFile`).
 *
 * Steps aside when core already marked a row, so it turns itself off once fixed upstream.
 * Not fixed upstream as of Foundry 14.370. Add a FIXED_IN_VERSION gate once it is.
 */
export function initFixFilePickerCurrentFile() {
    const FilePicker = foundry.applications.apps?.FilePicker;
    if (!FilePicker) return;

    patchMethod("foundry.applications.apps.FilePicker.prototype._onRender", async function patchedOnRender(wrapped, context, options) {
        await wrapped(context, options);
        try {
            markCurrentFile(this);
        } catch (err) {
            console.error("niks-foundry-tweaks | File Picker current file:", err);
        }
    }, "WRAPPER");

    log("Patched FilePicker._onRender to mark the current file");
}

/**
 * Normalize a path for comparison: URI-decoded, without a query string or hash.
 * @param {string} path
 * @returns {string}
 */
function normalize(path) {
    let p = String(path ?? "").split(/[?#]/)[0];
    try {
        p = decodeURIComponent(p);
    } catch {
        // Malformed escape sequences: compare as is
    }
    return p;
}

/**
 * @param {FilePicker} app
 */
function markCurrentFile(app) {
    const form = app.element;
    const rows = form.querySelectorAll(".file[data-path]");
    if (!rows.length || form.querySelector(".file.picked")) return;

    const current = normalize(form.elements.file?.value || app.request);
    if (!current) return;
    const row = Array.from(rows).find(r => normalize(r.dataset.path) === current);
    if (!row) return;
    row.classList.add("picked");

    // Scroll to it once per folder, not on every re-render (e.g. changing the display mode)
    const key = `${app.activeSource}:${app.source?.target}`;
    if (app._nftScrolledToPick === key) return;
    app._nftScrolledToPick = key;
    row.scrollIntoView({ block: "nearest" });
}
