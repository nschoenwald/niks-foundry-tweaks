/**
 * Feature: File Picker Thumbnails
 * Description: Shows small cached thumbnails instead of the full-size images in the file picker's tile and thumbnail
 * views. Each image is downloaded and shrunk once per browser, then served from the browser's own storage.
 *
 * @introduced v14.13.0
 */
import { MODULE_ID, debug, isFeatureActive } from "../../context.js";
import { patchMethod } from "../../utils/patch-helper.js";

/** Longest side of a thumbnail in pixels (2× the 100px tiles, for high-DPI screens). */
const THUMB_SIZE = 256;
/** Images already this small (and no larger than THUMB_SIZE) are stored as they are. */
const SMALL_FILE_BYTES = 48 * 1024;
const THUMB_TYPE = "image/webp";
const THUMB_QUALITY = 0.8;

/** Thumbnails older than this are made again, so replaced files show up eventually. */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
/** Oldest-used thumbnails beyond this many are deleted. */
const MAX_ENTRIES = 4000;
/** "used" is only rewritten when older than this, to keep reads cheap. */
const TOUCH_INTERVAL = 24 * 60 * 60 * 1000;
/** Full-size downloads running at once. */
const CONCURRENCY = 4;

const DB_NAME = `${MODULE_ID}-file-picker-thumbnails`;
const STORE = "thumbs";

/** Transparent 1×1 GIF, set as src so the browser never starts loading the full image. */
const PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** SVGs are small and can't be decoded by createImageBitmap; GIFs would lose their animation. */
const SKIP_PATTERN = /\.(svg|gif)$/i;

/** Display modes that show small images. "list" hides them, "images" shows them large (left alone). */
const THUMB_MODES = new Set(["thumbs", "tiles", "nftCompactTiles"]);

const FILE_PICKER = "foundry.applications.apps.FilePicker";

let _patched = false;

/**
 * @typedef {object} Thumbnail
 * @property {string} src     Object URL of the thumbnail, or the file itself when no thumbnail could be made
 * @property {number} [width]  Size of the original image
 * @property {number} [height]
 */

/** @type {Map<string, Thumbnail>} Absolute URL → thumbnail, for this session */
const _memory = new Map();
/** @type {Map<string, Promise<Thumbnail>>} Absolute URL → thumbnail being made */
const _pending = new Map();
/** @type {Set<string>} Absolute URLs that failed this session (CORS, decoding): shown at full size */
const _failed = new Set();

function _active() {
    return isFeatureActive("enableFilePickerThumbnails", "clientEnableFilePickerThumbnails");
}

/** Called at setup and whenever one of the two settings changes. Patches check the settings on each call. */
export function initFilePickerThumbnails() {
    if (_patched || !_active()) return;
    if (!globalThis.OffscreenCanvas || !globalThis.createImageBitmap) {
        debug("File Picker Thumbnails: OffscreenCanvas or createImageBitmap missing, feature unavailable");
        return;
    }
    _patched = true;

    // Keep the browser from loading full-size images: the template gets a placeholder, _onRender swaps in thumbnails
    patchMethod(`${FILE_PICKER}.prototype._prepareContext`, async function (wrapped, ...args) {
        const context = await wrapped(...args);
        if (!_active() || this.displayMode === "images") return context;
        for (const file of context.files ?? []) {
            if (file.img && !_skip(file.img)) file.img = PLACEHOLDER;
        }
        return context;
    }, "WRAPPER");

    patchMethod(`${FILE_PICKER}.prototype._onRender`, async function (wrapped, context, options) {
        await wrapped(context, options);
        if (!_active() || !options.parts?.includes("body")) return;
        try {
            _observeImages(this);
        } catch (err) {
            console.error(`${MODULE_ID} | File Picker Thumbnails:`, err);
        }
    }, "WRAPPER");

    patchMethod(`${FILE_PICKER}.prototype._tearDown`, function (wrapped, ...args) {
        this._nftThumbObserver?.disconnect();
        return wrapped(...args);
    }, "WRAPPER");

    // ⋮ menu entry to remake the thumbnails of the current folder (e.g. after replacing a file under the same name)
    patchMethod(`${FILE_PICKER}.prototype._getHeaderControls`, function (wrapped, ...args) {
        const controls = wrapped(...args);
        if (!_active()) return controls;
        controls.push({
            action: "nftRefreshThumbnails",
            icon: "fa-solid fa-arrows-rotate",
            label: "NFT.FilePickerThumbnails.Refresh",
            onClick: () => _refreshFolder(this)
        });
        return controls;
    }, "WRAPPER");

    debug("File Picker Thumbnails enabled");
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function _skip(path) {
    return SKIP_PATTERN.test(String(path).split(/[?#]/)[0]);
}

/**
 * @param {string} path  Path as shown in the picker (relative, or a full S3 URL)
 * @returns {string}     Absolute URL, the cache key
 */
function _absolute(path) {
    return new URL(path, document.baseURI).href;
}

/**
 * Load thumbnails for the image rows as they scroll near the visible area.
 * @param {FilePicker} app
 */
function _observeImages(app) {
    app._nftThumbObserver?.disconnect();
    const body = app.element.querySelector("section[data-files]");
    if (!body) return;

    const images = [];
    for (const img of body.querySelectorAll("li.file img")) {
        img.decoding = "async";
        img.fetchPriority = "low";
        if (img.getAttribute("src") === PLACEHOLDER) images.push(img);
    }
    if (!images.length || !THUMB_MODES.has(app.displayMode)) return;

    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            const img = entry.target;
            const path = img.closest("li.file")?.dataset.path;
            if (!path) continue;
            getThumbnail(path).then(thumb => {
                if (!img.isConnected) return;
                img.src = thumb.src;
                // Core sizes the drag preview (picker → Tiles layer) from naturalWidth/Height: report the original's
                if (thumb.width && thumb.height) {
                    Object.defineProperty(img, "naturalWidth", { value: thumb.width, configurable: true });
                    Object.defineProperty(img, "naturalHeight", { value: thumb.height, configurable: true });
                }
            });
        }
    }, { root: body, rootMargin: "300px 0px" });
    for (const img of images) observer.observe(img);
    app._nftThumbObserver = observer;
}

/**
 * Thumbnail for a file: from memory, the browser's storage, or made now. Falls back to the file itself.
 * @param {string} path
 * @returns {Promise<Thumbnail>}
 */
export function getThumbnail(path) {
    let url;
    try {
        url = _absolute(path);
    } catch {
        return Promise.resolve({ src: path });
    }
    if (_memory.has(url)) return Promise.resolve(_memory.get(url));
    if (_failed.has(url)) return Promise.resolve({ src: path });
    if (_pending.has(url)) return _pending.get(url);

    const promise = (async () => {
        try {
            let entry = await _dbGet(url);
            if (!entry) {
                entry = await _queue(() => _createThumbnail(url));
                _dbPut(url, entry);
            }
            const thumb = { src: URL.createObjectURL(entry.blob), width: entry.width, height: entry.height };
            _memory.set(url, thumb);
            return thumb;
        } catch (err) {
            _failed.add(url);
            debug(`File Picker Thumbnails: showing ${path} at full size`, err);
            return { src: path };
        } finally {
            _pending.delete(url);
        }
    })();
    _pending.set(url, promise);
    return promise;
}

/**
 * Download the image and shrink it to THUMB_SIZE on its longest side.
 * @param {string} url
 * @returns {Promise<{blob: Blob, width: number, height: number}>}  The thumbnail and the original's size
 */
async function _createThumbnail(url) {
    let response;
    try {
        response = await fetch(url, { mode: "cors", credentials: "same-origin" });
    } catch (err) {
        // A copy cached from a plain <img> load can lack the CORS header (common with S3): ask the server again
        response = await fetch(url, { mode: "cors", credentials: "same-origin", cache: "reload" });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    // Decodes off the main thread
    const full = await createImageBitmap(blob);
    try {
        const scale = Math.min(1, THUMB_SIZE / Math.max(full.width, full.height));
        const size = { width: full.width, height: full.height };
        if (scale === 1 && blob.size <= SMALL_FILE_BYTES) return { blob, ...size };
        const width = Math.max(1, Math.round(full.width * scale));
        const height = Math.max(1, Math.round(full.height * scale));
        const small = await createImageBitmap(full, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
        try {
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext("2d").drawImage(small, 0, 0);
            return { blob: await canvas.convertToBlob({ type: THUMB_TYPE, quality: THUMB_QUALITY }), ...size };
        } finally {
            small.close();
        }
    } finally {
        full.close();
    }
}

/* -------------------------------------------- */
/*  Download queue                              */
/* -------------------------------------------- */

let _running = 0;
const _waiting = [];

/**
 * Run a task with at most CONCURRENCY running at once.
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
async function _queue(task) {
    if (_running >= CONCURRENCY) await new Promise(resolve => _waiting.push(resolve));
    _running++;
    try {
        return await task();
    } finally {
        _running--;
        _waiting.shift()?.();
    }
}

/* -------------------------------------------- */
/*  Browser storage (IndexedDB, also works over plain http)  */
/* -------------------------------------------- */

/** @type {Promise<IDBDatabase|null>|null} */
let _dbPromise = null;

/** @returns {Promise<IDBDatabase|null>} null when IndexedDB is unavailable (e.g. blocked site data) */
function _db() {
    _dbPromise ??= new Promise(resolve => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore(STORE);
                store.createIndex("used", "used");
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return _dbPromise;
}

/**
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function _done(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
function _complete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
    });
}

/**
 * @param {string} url
 * @returns {Promise<{blob: Blob, width: number, height: number}|null>}  The stored entry, or null when missing or too old
 */
async function _dbGet(url) {
    const db = await _db();
    if (!db) return null;
    try {
        const entry = await _done(db.transaction(STORE).objectStore(STORE).get(url));
        if (!entry?.blob) return null;
        const now = Date.now();
        if (now - entry.created > MAX_AGE) return null;
        if (now - entry.used > TOUCH_INTERVAL) {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put({ ...entry, used: now }, url);
        }
        return entry;
    } catch {
        return null;
    }
}

/**
 * @param {string} url
 * @param {{blob: Blob, width: number, height: number}} thumb
 */
async function _dbPut(url, { blob, width, height }) {
    const db = await _db();
    if (!db) return;
    try {
        const now = Date.now();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ blob, width, height, created: now, used: now }, url);
        await _complete(tx);
        _schedulePrune();
    } catch (err) {
        debug("File Picker Thumbnails: could not store a thumbnail", err);
    }
}

/**
 * @param {string[]} urls
 */
async function _dbDelete(urls) {
    const db = await _db();
    if (!db || !urls.length) return;
    try {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        for (const url of urls) store.delete(url);
        await _complete(tx);
    } catch (err) {
        debug("File Picker Thumbnails: could not delete thumbnails", err);
    }
}

let _pruneTimer = null;

function _schedulePrune() {
    clearTimeout(_pruneTimer);
    _pruneTimer = setTimeout(_prune, 10000);
}

/** Delete the least recently used thumbnails beyond MAX_ENTRIES. */
async function _prune() {
    const db = await _db();
    if (!db) return;
    try {
        const count = await _done(db.transaction(STORE).objectStore(STORE).count());
        let excess = count - MAX_ENTRIES;
        if (excess <= 0) return;
        const tx = db.transaction(STORE, "readwrite");
        const request = tx.objectStore(STORE).index("used").openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || excess-- <= 0) return;
            cursor.delete();
            cursor.continue();
        };
        await _complete(tx);
        debug(`File Picker Thumbnails: pruned ${count - MAX_ENTRIES} thumbnails`);
    } catch (err) {
        debug("File Picker Thumbnails: pruning failed", err);
    }
}

/**
 * Forget the thumbnails of every file in the picker's current folder and make them again.
 * @param {FilePicker} app
 */
async function _refreshFolder(app) {
    const urls = [];
    for (const li of app.element.querySelectorAll("li.file[data-path]")) {
        let url;
        try {
            url = _absolute(li.dataset.path);
        } catch {
            continue;
        }
        urls.push(url);
        const thumb = _memory.get(url);
        if (thumb?.src.startsWith("blob:")) URL.revokeObjectURL(thumb.src);
        _memory.delete(url);
        _failed.delete(url);
    }
    await _dbDelete(urls);
    await app.render({ parts: ["body"] });
}
