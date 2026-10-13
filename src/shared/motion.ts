/**
 * Subtitle transition settings shared by the main process (window room for
 * moving lines, validation) and the renderers (the transitions themselves).
 * Keep this file free of Node/DOM imports.
 */

import type { LineEffect, MotionEasing, SlideDirection, SubtitleMotion } from "./types";

export const LINE_EFFECTS: LineEffect[] = ["none", "fade", "blur", "slide", "zoom", "wipe"];
export const MOTION_EASINGS: MotionEasing[] = ["out", "inOut", "linear", "spring"];
export const SLIDE_DIRECTIONS: SlideDirection[] = ["up", "down", "left", "right"];

/** Effect-specific settings; the shared ones (timing, easing…) apply to every effect but "none". */
export const EFFECT_PARAMS: Record<LineEffect, ("blur" | "direction" | "distance" | "zoom")[]> = {
  none: [],
  fade: [],
  blur: ["blur"],
  slide: ["direction", "distance"],
  zoom: ["zoom"],
  wipe: [],
};

export const MOTION_LIMITS = {
  enterMs: { min: 0, max: 1000, step: 10 },
  exitMs: { min: 0, max: 1000, step: 10 },
  blur: { min: 1, max: 16, step: 1 },
  distance: { min: 2, max: 48, step: 1 },
  zoom: { min: 0.6, max: 0.98, step: 0.01 },
  bridgeMs: { min: 0, max: 500, step: 10 },
  toggleMs: { min: 0, max: 800, step: 10 },
} as const;

export const DEFAULT_MOTION: SubtitleMotion = {
  effect: "blur",
  enterMs: 200,
  exitMs: 140,
  easing: "out",
  blur: 4,
  direction: "up",
  distance: 10,
  zoom: 0.92,
  overlap: "cross",
  bridgeMs: 120,
  toggleMs: 200,
};

/**
 * How far a transition can paint below the subtitle's bottom edge, px: a
 * vertical slide starts (or ends) that far down, and a blur spreads. The
 * overlay window keeps this much room so nothing is cut off mid-transition.
 */
export function motionBleed(motion: SubtitleMotion): number {
  if (motion.effect === "slide" && (motion.direction === "up" || motion.direction === "down")) {
    return Math.ceil(motion.distance);
  }
  if (motion.effect === "blur") return Math.ceil(motion.blur * 2);
  return 0;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const within = (value: unknown, limits: { min: number; max: number }, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(limits.max, Math.max(limits.min, value))
    : fallback;

/** Clamp every field to what the app can render; unknown values fall back to the defaults. */
export function sanitizeMotion(value: Partial<SubtitleMotion> | undefined): SubtitleMotion {
  const m = value ?? {};
  const d = DEFAULT_MOTION;
  return {
    effect: pick(m.effect, LINE_EFFECTS, d.effect),
    enterMs: within(m.enterMs, MOTION_LIMITS.enterMs, d.enterMs),
    exitMs: within(m.exitMs, MOTION_LIMITS.exitMs, d.exitMs),
    easing: pick(m.easing, MOTION_EASINGS, d.easing),
    blur: within(m.blur, MOTION_LIMITS.blur, d.blur),
    direction: pick(m.direction, SLIDE_DIRECTIONS, d.direction),
    distance: within(m.distance, MOTION_LIMITS.distance, d.distance),
    zoom: within(m.zoom, MOTION_LIMITS.zoom, d.zoom),
    overlap: pick(m.overlap, ["cross", "sequential"] as const, d.overlap),
    bridgeMs: within(m.bridgeMs, MOTION_LIMITS.bridgeMs, d.bridgeMs),
    toggleMs: within(m.toggleMs, MOTION_LIMITS.toggleMs, d.toggleMs),
  };
}
