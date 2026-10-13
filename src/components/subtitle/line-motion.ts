import type { TargetAndTransition, Transition } from "motion/react";
import type { MotionEasing, SubtitleMotion } from "@/shared/types";

const EASE_CURVES: Record<Exclude<MotionEasing, "spring">, Transition["ease"]> = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  linear: "linear",
};

/** Soft edge of the "wipe" reveal, as a share of the line's width. */
const WIPE_FEATHER = 18;

export interface LineMotion {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  /** Static styles the effect needs on the line (transform origin, mask…). */
  style: React.CSSProperties;
}

/**
 * Timing for one direction of a transition. Springs only drive movement;
 * opacity, blur and the wipe always follow a curve so they never overshoot.
 */
function timing(motion: SubtitleMotion, ms: number): Transition {
  const duration = ms / 1000;
  const curve: Transition = {
    duration,
    ease: motion.easing === "spring" ? EASE_CURVES.out : EASE_CURVES[motion.easing],
  };
  if (motion.easing !== "spring" || duration === 0) return curve;
  return { type: "spring", duration: duration * 1.6, bounce: 0.32, opacity: curve, filter: curve };
}

function offset(motion: SubtitleMotion, sign: 1 | -1, scale: number): { x?: number; y?: number } {
  const d = motion.distance * scale * sign;
  switch (motion.direction) {
    case "up":
      return { y: d };
    case "down":
      return { y: -d };
    case "left":
      return { x: d };
    case "right":
      return { x: -d };
  }
}

/**
 * motion/react props for a subtitle line entering and leaving with the
 * chosen effect. `scale` is the preview scale, so distances shrink with the text.
 *
 * The system's reduced-motion preference is deliberately not applied here:
 * the effect is the user's explicit choice in the app ("none" turns it off),
 * and many gaming PCs switch Windows animations off for speed, which would
 * otherwise silently flatten every effect into a fade.
 */
export function lineMotion(motion: SubtitleMotion, scale = 1): LineMotion {
  const effect = motion.effect;
  const enter = timing(motion, motion.enterMs);
  const leave = timing(motion, motion.exitMs);

  switch (effect) {
    case "none":
      return {
        initial: false,
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0 } },
        style: {},
      };
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: enter },
        exit: { opacity: 0, transition: leave },
        style: {},
      };
    case "blur": {
      const radius = motion.blur * scale;
      return {
        initial: { opacity: 0, filter: `blur(${radius}px)` },
        // Drop the filter once settled so the text renders exactly as without one.
        animate: { opacity: 1, filter: "blur(0px)", transition: enter, transitionEnd: { filter: "none" } },
        exit: { opacity: 0, filter: `blur(${radius * 0.75}px)`, transition: leave },
        style: {},
      };
    }
    case "slide":
      return {
        initial: { opacity: 0, ...offset(motion, 1, scale) },
        animate: { opacity: 1, x: 0, y: 0, transition: enter },
        exit: { opacity: 0, ...offset(motion, -1, scale), transition: leave },
        style: {},
      };
    case "zoom":
      return {
        initial: { opacity: 0, scale: motion.zoom },
        animate: { opacity: 1, scale: 1, transition: enter },
        // The old line swells a little as it fades, so the two never shrink into each other.
        exit: { opacity: 0, scale: 1 + (1 - motion.zoom) / 2, transition: leave },
        style: { transformOrigin: "50% 100%" },
      };
    case "wipe": {
      const curve = { duration: motion.enterMs / 1000, ease: EASE_CURVES[motion.easing === "spring" ? "out" : motion.easing] };
      return {
        initial: { "--wipe": "0%" } as TargetAndTransition,
        animate: { "--wipe": `${100 + WIPE_FEATHER}%`, transition: curve, transitionEnd: { maskImage: "none" } } as TargetAndTransition,
        exit: { opacity: 0, transition: leave },
        style: {
          maskImage: `linear-gradient(90deg, #000 calc(var(--wipe) - ${WIPE_FEATHER}%), transparent var(--wipe))`,
          // The mask stops at the border box; padding keeps outline and shadow inside it.
          padding: `${12 * scale}px ${16 * scale}px`,
          margin: `${-12 * scale}px ${-16 * scale}px`,
        },
      };
    }
  }
}
