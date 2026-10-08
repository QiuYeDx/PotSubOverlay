import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CaptionsOff,
  ChevronsLeft,
  ChevronsRight,
  History,
  Pause,
  Play,
  RotateCcw,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SubtitleView } from "@/components/subtitle/SubtitleView";
import type { OverlayRecall, OverlayStyle, OverlayToast } from "@/shared/types";
import type { OverlayStrings } from "./strings";

const TOAST_MS = 1300;
const RECALL_SCALE = 0.82;

/**
 * Chrome drawn over arbitrary game frames: a dark, blurred pill keeps the
 * label readable on both bright and dark scenes.
 */
const PILL_STYLE = {
  background: "rgba(22,22,24,0.66)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.10), 0 4px 16px rgba(0,0,0,0.30)",
  backdropFilter: "blur(14px) saturate(150%)",
} as const;

const TOAST_ICONS: Record<OverlayToast["kind"], LucideIcon> = {
  pause: Pause,
  play: Play,
  replay: RotateCcw,
  back: ChevronsLeft,
  forward: ChevronsRight,
  noPlayer: Unplug,
  noLine: CaptionsOff,
};

/** A missed line, shown smaller above the live subtitles. */
export function RecallView({
  recall,
  style,
  strings,
}: {
  recall: OverlayRecall | null;
  style: OverlayStyle;
  strings: OverlayStrings;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {recall ? (
        <motion.div
          key="recall"
          className="mb-4 flex w-full flex-col items-center gap-1.5"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
          transition={{ type: "spring", duration: 0.32, bounce: 0 }}
        >
          <div
            className="flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold tracking-wide text-white/90"
            style={PILL_STYLE}
          >
            <History className="size-3.5" strokeWidth={2.4} />
            {strings.recall(recall.depth)}
          </div>
          <div className="w-full opacity-90">
            <SubtitleView display={recall.display} style={style} scale={RECALL_SCALE} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The brief confirmation after a playback hotkey; a new one replaces the old. */
export function ToastView({ toast, strings }: { toast: OverlayToast | null; strings: OverlayStrings }) {
  const [shown, setShown] = useState<OverlayToast | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const timer = setTimeout(() => setShown((current) => (current?.id === toast.id ? null : current)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const Icon = shown ? TOAST_ICONS[shown.kind] : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {shown && Icon ? (
          <motion.div
            key={shown.id}
            className="flex h-8 items-center gap-2 rounded-full pr-3.5 pl-3 text-[13px] font-semibold text-white"
            style={PILL_STYLE}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
            transition={{ type: "spring", duration: 0.28, bounce: 0 }}
          >
            <Icon className="size-4" strokeWidth={2.4} />
            {strings.toast[shown.kind](shown.seconds ?? 0)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
