/**
 * Feature: Boss Loot FX Animation Opacity
 * Description: Plays Boss Loot FX (BLFX) animations at a set percentage of their normal opacity, so tokens, templates
 *              and the map stay visible underneath.
 *
 * Direct reference to Sequencer:
 * - EffectSection#run calls `Hooks.call("preCreateSequencerEffect", data)` with the sanitized effect data before the
 *   effect is created, pushed to the other clients and (when persistent) saved. Changing `data.opacity` there is what
 *   every client plays and what a persistent effect is saved with; effects restored from a scene don't pass through
 *   the hook again, so the factor is never applied twice.
 * - `data.file` is the Sequencer database path when the file came from the database (`file?.dbPath ?? file`).
 *   BLFX never names its sequences (`new Sequence()`), but all its animations come from its asset packs, whose
 *   database paths start with `blfx.` or `blfx02.`. Token copies (`.copySprite`) and sounds don't match.
 * - Opacity is a multiplier: BLFX's own opacity values (0.2, 0.5, …) and fade-ins (which fade to `data.opacity`)
 *   scale with it, and effects BLFX hides with `.opacity(0)` stay hidden.
 *
 * World setting only: the caster's client sets the opacity for everyone, so a personal opt-out couldn't work.
 *
 * @introduced v14.20.0
 */
import { debug, getSetting } from "../../context.js";

const BLFX_PATH = /^blfx\d*\./;

let initialized = false;

function isBlfxFile(file) {
    if (Array.isArray(file)) return file.some(isBlfxFile);
    return typeof file === "string" && BLFX_PATH.test(file);
}

function onPreCreateEffect(data) {
    try {
        if (!getSetting("enableBlfxAnimationOpacity") || !isBlfxFile(data?.file)) return;
        const percent = Math.clamp(Number(getSetting("blfxAnimationOpacity")) || 0, 0, 100);
        const opacity = Number.isFinite(data.opacity) ? data.opacity : 1;
        data.opacity = opacity * percent / 100;
        debug("BLFX animation opacity:", data.file, opacity, "→", data.opacity);
    } catch (err) {
        debug("BLFX animation opacity: left unchanged after an error", err);
    }
}

export function initBlfxAnimationOpacity() {
    if (initialized) return;
    initialized = true;
    Hooks.on("preCreateSequencerEffect", onPreCreateEffect);
}
