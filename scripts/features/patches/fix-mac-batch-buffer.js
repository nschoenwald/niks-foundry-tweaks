/**
 * Feature: macOS Canvas Performance Patch
 * Description: Fixes an upstream Foundry V14 / PIXI issue where canvas FPS on Macs collapses as more tokens are placed on a scene.
 *
 * @introduced v14.1.2
 */
import { log } from "../../context.js";

/**
 * Fix: Canvas FPS Collapses With Token Count on macOS (Metal)
 * ---------------------------------------------------------------------------
 * Foundry issue #14967. PIXI v7 defaults `BatchRenderer.canUploadSameBuffer` to
 * `!isMobile.apple.device`, so on desktop every batch flush in a frame
 * overwrites the same vertex/index buffer.
 *
 *  1. On macOS, browsers run WebGL through Metal (ANGLE Metal in Chrome,
 *     Electron and Safari). Metal doesn't rename a buffer the GPU is still
 *     reading, so each overwrite stalls or splits the render pass.
 *  2. With many tokens there are ~100 flushes per frame, so FPS drops steeply
 *     (reported: 120 → 22 FPS at 80 tokens, 10 FPS at 200 tokens on an M1 Max).
 *  3. PIXI already avoids this on iOS by using a pool of buffers (one per
 *     flush) instead, but Macs keep the desktop default.
 *
 * This sets the flag to `false` on macOS, the same path PIXI uses on iPhones
 * and iPads. `BatchRenderer#flush` and `#start` read the static on every flush,
 * and Foundry's `BatchRenderer` extends PIXI's, so setting it once covers all
 * batch renderers, also for a canvas that is already drawn. Draw calls and
 * uploads per frame are unchanged; only buffer reuse differs. Windows and Linux
 * (Direct3D, Vulkan, desktop GL rename buffers transparently) are left alone.
 *
 * Not fixed upstream as of Foundry 14.370. Add a FIXED_IN_VERSION gate once it is.
 */
export function initFixMacBatchBuffer() {
    const BatchRenderer = globalThis.PIXI?.BatchRenderer;
    if (!BatchRenderer || !isMacOS()) return;
    if (BatchRenderer.canUploadSameBuffer === false) return;

    BatchRenderer.canUploadSameBuffer = false;
    log("Set PIXI.BatchRenderer.canUploadSameBuffer = false on macOS (Foundry issue #14967)");
}

/**
 * Whether the client runs on macOS (desktop browser or the Electron app).
 * @returns {boolean}
 */
function isMacOS() {
    const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "";
    return /^mac/i.test(platform);
}
