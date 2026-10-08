import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
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

function OverlayApp() {
  const [display, setDisplay] = useState<DisplayPayload>(EMPTY);
  const [style, setStyle] = useState<OverlayStyle>(DEFAULT_STYLE);
  const [mode, setMode] = useState<OverlayModeMessage | null>(null);
  // Hidden while the main process resizes the window between modes.
  const [preparing, setPreparing] = useState(false);
  // Whether subtitles should be seen (off, or hidden while PotPlayer is in front).
  const [visible, setVisible] = useState(false);
  const [recall, setRecall] = useState<OverlayRecall | null>(null);
  const [toast, setToast] = useState<OverlayToast | null>(null);

  useEffect(() => {
    const api = window.overlayApi;
    const offs = [
      api.on("overlay:display", (payload: DisplayPayload) => setDisplay(payload)),
      api.on("overlay:style", (next: OverlayStyle) => setStyle(next)),
      api.on("overlay:prepare", () => setPreparing(true)),
      api.on("overlay:visible", (next: boolean) => setVisible(next)),
      api.on("overlay:recall", (next: OverlayRecall | null) => setRecall(next)),
      api.on("overlay:toast", (next: OverlayToast) => setToast(next)),
      api.on("overlay:mode", (next: OverlayModeMessage) => {
        setMode(next);
        setPreparing(false);
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
  }, []);

  const editing = mode?.editing ?? false;
  const strings = stringsFor(mode?.locale ?? "zh");

  return (
    <div className="h-full w-full" style={{ opacity: preparing ? 0 : 1 }}>
      <AnimatePresence mode="wait" initial={false}>
        {editing && mode ? (
          <motion.div
            key="edit"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <EditStage mode={mode} display={display} style={style} />
          </motion.div>
        ) : (
          <motion.div
            key="live"
            className="relative flex h-full w-full flex-col items-center justify-end px-2 pb-2"
            initial={{ opacity: 0 }}
            // Motion animates from the current opacity, so rapid toggles
            // reverse smoothly instead of restarting.
            animate={{ opacity: visible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: visible ? 0.22 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <ToastView toast={toast} strings={strings} />
            <RecallView recall={recall} style={style} strings={strings} />
            <SubtitleView display={display} style={style} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OverlayApp;
