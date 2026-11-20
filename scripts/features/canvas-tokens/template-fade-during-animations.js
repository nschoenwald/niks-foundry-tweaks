/**
 * Feature: Fade Templates During Animations
 * Description: While a Sequencer animation plays on a template (or any other region), the region's colored fill is
 *              drawn fainter, so the animation isn't hidden behind it. The fill comes back when the last animation
 *              on it ends.
 *
 * Direct reference to Foundry V14 and Sequencer:
 * - V14 templates are Regions. Region#_draw adds the fill as a RegionMesh (HighlightRegionShader) to
 *   canvas.regions._highlights and sets its alpha to 0.5. The render flags only change its tint and hatching, so a
 *   lowered alpha stays until the region is drawn again (the drawRegion hook re-applies it). The mesh is private
 *   (Region##highlight); it is found by RegionMesh#region.
 * - Sequencer calls createSequencerEffect from CanvasEffect#play and endedSequencerEffect from CanvasEffect#endEffect
 *   on every client that shows the effect. CanvasEffect#sourceDocument / #targetDocument resolve
 *   .atLocation(region), .attachTo(region) and .stretchTo(region) to the RegionDocument. Effects placed at a point
 *   don't count.
 *
 * @introduced v14.16.0
 */
import { debug, getSetting, isFeatureActive } from "../../context.js";

const DEFAULT_ALPHA = 0.5; // Region#_draw
const FADE_MS = 250;

/** @type {Map<string, Set<object>>} Region id -> Sequencer effects playing on it */
const playing = new Map();
let initialized = false;

const isActive = () => isFeatureActive("enableTemplateFadeDuringAnimations", "clientEnableTemplateFadeDuringAnimations");

/** Opacity of a faded fill: the setting is a percentage of the normal opacity (0 to 100). */
function fadedAlpha() {
    const percent = Math.clamp(Number(getSetting("templateFadeOpacity")) || 0, 0, 100);
    return DEFAULT_ALPHA * percent / 100;
}

/** The RegionDocument an effect is placed on, if any. */
function regionOf(effect) {
    for (const key of ["sourceDocument", "targetDocument"]) {
        try {
            const doc = effect?.[key];
            if (doc?.documentName === "Region" && doc.id) return doc;
        } catch {
            // A source that can't be resolved is not a region.
        }
    }
    return null;
}

function highlightOf(region) {
    if (!region || region.destroyed) return null;
    return canvas.regions?._highlights?.children.find(mesh => mesh.region === region) ?? null;
}

function setAlpha(region, to, { animate = true } = {}) {
    const mesh = highlightOf(region);
    if (!mesh || mesh.destroyed) return;
    const name = `niks-foundry-tweaks.templateFade.${region.document.id}`;
    const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;
    CanvasAnimation.terminateAnimation(name);
    if (!animate || mesh.alpha === to) {
        mesh.alpha = to;
        return;
    }
    CanvasAnimation.animate([{ parent: mesh, attribute: "alpha", to }], { name, duration: FADE_MS });
}

/** Fade or restore one region to match the effects playing on it. */
function update(regionId, options) {
    const region = canvas.regions?.get(regionId);
    if (!region) return;
    const faded = isActive() && (playing.get(regionId)?.size ?? 0) > 0;
    setAlpha(region, faded ? fadedAlpha() : DEFAULT_ALPHA, options);
}

/** Re-apply every region, e.g. after a setting changed. */
export function updateTemplateFade() {
    if (!canvas.ready) return;
    for (const regionId of playing.keys()) update(regionId);
}

function onCreateEffect(effect) {
    const region = regionOf(effect);
    if (!region) return;
    let effects = playing.get(region.id);
    if (!effects) playing.set(region.id, effects = new Set());
    effects.add(effect);
    debug("Template fade: animation started on region", region.name, effect.data?.file);
    update(region.id);
}

function onEndEffect(effect) {
    for (const [regionId, effects] of playing) {
        if (!effects.delete(effect)) continue;
        if (!effects.size) playing.delete(regionId);
        update(regionId);
    }
}

export function initTemplateFadeDuringAnimations() {
    if (initialized) return;
    initialized = true;

    Hooks.on("createSequencerEffect", onCreateEffect);
    Hooks.on("endedSequencerEffect", onEndEffect);
    // Redrawing a region resets its fill to the default opacity.
    Hooks.on("drawRegion", region => {
        if (playing.has(region.document.id)) update(region.document.id, { animate: false });
    });
    Hooks.on("deleteRegion", doc => playing.delete(doc.id));
    Hooks.on("canvasTearDown", () => playing.clear());
}
