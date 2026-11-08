/**
 * Feature: Lighter Video Playback
 * Description: Stops sending new frames of animated scene backgrounds, tiles and tokens to the graphics card while
 * they are off screen or hidden, and can cap how many video frames per second are sent while they are visible.
 *
 * Why: PIXI's VideoResource uploads every decoded video frame to the GPU (via requestVideoFrameCallback), whether or
 * not the video is on screen. A 4K animated map at 30 fps is roughly 1 GB/s of texture uploads.
 *
 * How: every second the video meshes of the canvas are collected (`canvas.primary.levelTextures`, tile meshes, token
 * meshes) and grouped by their VideoResource (Foundry shares one video between tiles or tokens with the same file
 * unless it clones it). Every frame, a resource keeps uploading only while at least one of its meshes is visible and
 * intersects the screen (`resource.autoUpdate`). When it comes back into view, the current frame is uploaded at
 * once. The optional cap sets `resource.updateFPS` (PIXI then updates from `PIXI.Ticker.shared` at that rate instead
 * of every decoded frame). The videos themselves keep playing, so playback position, loops and sound are unchanged.
 * Turning the feature off restores `autoUpdate` and the original `updateFPS` of every touched resource.
 *
 * Not touched: Sequencer / Automated Animations effects (Sequencer manages its own video textures), video in
 * journals and other windows.
 *
 * Compatibility: Prime Performance doesn't change video textures (it only checks whether a token is a video to skip
 * its mesh fitting), so both work together.
 *
 * @introduced v14.2.0
 * @updated v14.2.2 (Personal setting can also turn it on when the GM left it off: Use World Setting / On / Off)
 */
import { MODULE_ID, debug, getSetting, clearSettingsCache } from "../../context.js";
import { isFeatureOnForUser } from "../../utils/personal-override.js";

/** How often the list of video meshes is rebuilt. */
const COLLECT_INTERVAL_MS = 1000;

let _active = false;
let _tickerAdded = false;
let _lastCollect = -Infinity;

/**
 * Video resources and the meshes showing them.
 * @type {Map<PIXI.VideoResource, PIXI.DisplayObject[]>}
 */
let _resources = new Map();

/**
 * Original `updateFPS` of every resource this feature changed, to restore it.
 * @type {Map<PIXI.VideoResource, number>}
 */
const _originalUpdateFps = new Map();

/** Resources whose uploads this feature turned off. */
const _paused = new Set();

const _bounds = new PIXI.Rectangle();

/**
 * Uploads the current video frame now. `VideoResource#update` can skip the upload while a frame cap is set (it
 * counts down to the next capped frame), so this calls the base implementation it would call.
 * @param {PIXI.VideoResource} resource
 */
function uploadNow(resource) {
    if (resource.destroyed) return;
    PIXI.BaseImageResource.prototype.update.call(resource);
}

/** @returns {number} Frame cap for visible videos, 0 = no cap */
function frameCap() {
    return Number(getSetting("videoFrameRateCap")) || 0;
}

/**
 * @param {PIXI.DisplayObject|null|undefined} mesh
 * @returns {PIXI.VideoResource|null}
 */
function videoResourceOf(mesh) {
    if (!mesh || mesh.destroyed) return null;
    const texture = mesh.texture;
    if (!texture?.valid) return null;
    const resource = texture.baseTexture?.resource;
    if (!resource || resource.destroyed) return null;
    return (resource.source?.tagName === "VIDEO") && ("autoUpdate" in resource) ? resource : null;
}

/** Rebuilds the resource → meshes map and applies the frame cap. */
function collect() {
    const resources = new Map();
    const add = mesh => {
        const resource = videoResourceOf(mesh);
        if (!resource) return;
        let meshes = resources.get(resource);
        if (!meshes) resources.set(resource, meshes = []);
        meshes.push(mesh);
    };
    for (const mesh of canvas.primary?.levelTextures ?? []) add(mesh);
    for (const tile of canvas.tiles?.placeables ?? []) add(tile.mesh);
    for (const token of canvas.tokens?.placeables ?? []) add(token.mesh);

    // Resources no longer shown on the canvas get their original behaviour back
    for (const resource of _resources.keys()) {
        if (!resources.has(resource)) restore(resource);
    }
    _resources = resources;

    const cap = frameCap();
    for (const resource of resources.keys()) {
        if (!_originalUpdateFps.has(resource)) _originalUpdateFps.set(resource, resource.updateFPS ?? 0);
        const wanted = cap || _originalUpdateFps.get(resource);
        if (resource.updateFPS !== wanted) resource.updateFPS = wanted;
    }
}

/**
 * Gives a resource its original upload behaviour back.
 * @param {PIXI.VideoResource} resource
 */
function restore(resource) {
    if (!resource.destroyed) {
        if (_originalUpdateFps.has(resource) && (resource.updateFPS !== _originalUpdateFps.get(resource))) {
            resource.updateFPS = _originalUpdateFps.get(resource);
        }
        if (_paused.has(resource) && !resource.autoUpdate) {
            resource.autoUpdate = true;
            uploadNow(resource);
        }
    }
    _paused.delete(resource);
    _originalUpdateFps.delete(resource);
}

/**
 * Whether a mesh can currently be seen on screen.
 * @param {PIXI.DisplayObject} mesh
 * @param {PIXI.Rectangle} screen
 */
function isOnScreen(mesh, screen) {
    if (mesh.destroyed || !mesh.worldVisible || !mesh.renderable || (mesh.worldAlpha <= 0)) return false;
    const bounds = mesh.getBounds(true, _bounds);
    if (!(bounds.width > 0) || !(bounds.height > 0)) return false;
    return bounds.intersects(screen);
}

/** Per-frame update of which video resources upload frames. */
function tick() {
    if (!_active || !canvas?.ready) return;
    const now = performance.now();
    if ((now - _lastCollect) >= COLLECT_INTERVAL_MS) {
        _lastCollect = now;
        collect();
    }
    const screen = canvas.app.renderer.screen;
    for (const [resource, meshes] of _resources) {
        if (resource.destroyed) continue;
        const visible = meshes.some(mesh => isOnScreen(mesh, screen));
        if (visible) {
            if (_paused.has(resource)) {
                _paused.delete(resource);
                resource.autoUpdate = true;
                // Upload the current frame right away instead of waiting for the next decoded one
                uploadNow(resource);
            }
        } else if (resource.autoUpdate) {
            resource.autoUpdate = false;
            _paused.add(resource);
        }
    }
}

/** Restores every resource this feature touched. */
function restoreAll() {
    for (const resource of [..._originalUpdateFps.keys(), ..._paused]) restore(resource);
    _resources = new Map();
    _lastCollect = -Infinity;
}

function ensureTicker() {
    if (_tickerAdded || !canvas?.app?.ticker) return;
    _tickerAdded = true;
    // Just before the canvas renders (rendering runs at LOW priority), using the previous frame's transforms
    canvas.app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.LOW + 1);
}

/**
 * Turns the feature on or off following the world and personal settings. Safe to call repeatedly.
 */
export function updateVideoOptimization() {
    for (const key of ["enableVideoOptimization", "clientVideoOptimization", "videoFrameRateCap"]) {
        clearSettingsCache(`${MODULE_ID}.${key}`);
    }
    const wasActive = _active;
    _active = isFeatureOnForUser("enableVideoOptimization", "clientVideoOptimization");
    if (_active) {
        if (canvas?.app?.ticker) ensureTicker();
        _lastCollect = -Infinity; // apply a changed cap on the next frame
    } else if (wasActive) {
        restoreAll();
    }
    debug(`Lighter Video Playback ${_active ? "enabled" : "disabled"}`);
}

/**
 * Registers the canvas hooks. Called once during setup.
 */
export function initVideoOptimization() {
    // The canvas application exists from canvasInit on; a new scene gets a fresh list
    Hooks.on("canvasInit", () => {
        restoreAll();
    });
    Hooks.on("canvasReady", () => {
        if (_active) ensureTicker();
        _lastCollect = -Infinity;
    });
    updateVideoOptimization();
}
