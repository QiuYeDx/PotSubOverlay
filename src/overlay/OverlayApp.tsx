import { motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SubtitleView } from "@/components/subtitle/SubtitleView";
import { DEFAULT_STYLE } from "@/shared/defaults";
import type {
  DisplayPayload,
  OverlayModeMessage,
  OverlayRecall,
  OverlayStyle,
  OverlayToast,
} from "@/shared/types";
import EditStage from "./EditStage";
import { RecallView, ToastView } from "./LiveExtras";
import { stringsFor } from "./strings";

declare global {
  interface Window {
    overlayApi: {
      on: (channel: string, listener: (...args: never[]) => void) => () => void;
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    };
  }
}

const EMPTY: DisplayPayload = { key: "", blocks: [] };
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Fade before the window moves or resizes, and back in afterwards. */
const PREPARE_FADE_S = 0.13;
const REVEAL_FADE_S = 0.22;
/** Stop waiting for the new window size after this long and show anyway. */
const RESIZE_WAIT_MS = 300;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Resolves once the page has been laid out at the window's new size (or after a timeout). */
function waitForViewport(viewport: OverlayModeMessage["viewport"]): Promise<void> {
  const fits = () =>
    Math.abs(window.innerWidth - viewport.width) <= 2 && Math.abs(window.innerHeight - viewport.height) <= 2;
  if (fits()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("resize", check);
      resolve();
    };
    const check = () => fits() && done();
    const timer = setTimeout(done, RESIZE_WAIT_MS);
    window.addEventListener("resize", check);
  });
}

function OverlayApp() {
  const [display, setDisplay] = useState<DisplayPayload>(EMPTY);
  const [style, setStyle] = useState<OverlayStyle>(DEFAULT_STYLE);
  const [mode, setMode] = useState<OverlayModeMessage | null>(null);
  // Whether the live subtitles should be seen (off, or hidden while PotPlayer is in front).
  const [visible, setVisible] = useState(false);
  const [recall, setRecall] = useState<OverlayRecall | null>(null);
  const [toast, setToast] = useState<OverlayToast | null>(null);
  const [root, animate] = useAnimate<HTMLDivElement>();
  /** The `overlay:prepare` whose window change has not been revealed yet. */
  const pendingReveal = useRef<number | null>(null);
  /** Bumped by every fade, so an older reveal still waiting gives way. */
  const fadeGeneration = useRef(0);

  useEffect(() => {
    const api = window.overlayApi;

    // Fade everything out, make sure a fully transparent frame is on screen,
    // then let the main process move or resize the window.
    const prepare = async (id: number) => {
      fadeGeneration.current += 1;
      pendingReveal.current = id;
      if (root.current) await animate(root.current, { opacity: 0 }, { duration: PREPARE_FADE_S, ease: "easeOut" });
      await nextFrame();
      await nextFrame();
      void api.invoke("overlay:prepared", id);
    };

    // After the change: wait until the page has the new size and has painted
    // it while still invisible, then fade in.
    const reveal = async (viewport: OverlayModeMessage["viewport"]) => {
      const generation = ++fadeGeneration.current;
      await waitForViewport(viewport);
      await nextFrame();
      await nextFrame();
      if (generation !== fadeGeneration.current || !root.current) return;
      void animate(root.current, { opacity: 1 }, { duration: REVEAL_FADE_S, ease: EASE_OUT });
    };

    const offs = [
      api.on("overlay:display", (payload: DisplayPayload) => setDisplay(payload)),
      api.on("overlay:style", (next: OverlayStyle) => setStyle(next)),
      api.on("overlay:prepare", (id: number) => void prepare(id)),
      api.on("overlay:visible", (next: boolean) => setVisible(next)),
      api.on("overlay:recall", (next: OverlayRecall | null) => setRecall(next)),
      api.on("overlay:toast", (next: OverlayToast) => setToast(next)),
      api.on("overlay:mode", (next: OverlayModeMessage) => {
        setMode(next);
        if (next.reveal !== null && next.reveal === pendingReveal.current) {
          pendingReveal.current = null;
          void reveal(next.viewport);
        }
      }),
    ];
    // Pull the current state after subscribing, so nothing pushed earlier is lost.
    void api
      .invoke<{
        visible: boolean;
        style: OverlayStyle;
        mode: OverlayModeMessage;
        display: DisplayPayload;
      } | null>("overlay:state")
      .then((state) => {
        if (!state) return;
        setVisible(state.visible);
        setStyle(state.style);
        setMode(state.mode);
        setDisplay(state.display);
      });
    return () => offs.forEach((off) => off());
  }, [animate, root]);

  const editing = mode?.editing ?? false;
  const strings = stringsFor(mode?.locale ?? "zh");
  const toggleS = style.motion.toggleMs / 1000;

  return (
    <div ref={root} className="relative h-full w-full">
      {/* The live layer stays mounted through edit mode, so leaving it does not replay its fade-in. */}
      <motion.div
        className="relative flex h-full w-full flex-col items-center justify-end px-2"
        style={{
          paddingBottom: 8 + (editing ? 0 : (mode?.bottomInset ?? 0)),
          visibility: editing ? "hidden" : undefined,
        }}
        initial={false}
        // Motion animates from the current opacity, so rapid toggles reverse smoothly.
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: visible ? toggleS : toggleS * 0.8, ease: EASE_OUT }}
      >
        <ToastView toast={toast} strings={strings} />
        <RecallView recall={recall} style={style} strings={strings} />
        <SubtitleView display={display} style={style} />
      </motion.div>
      {editing && mode ? (
        <div className="absolute inset-0">
          <EditStage mode={mode} display={display} style={style} />
        </div>
      ) : null}
    </div>
  );
}

export default OverlayApp;
