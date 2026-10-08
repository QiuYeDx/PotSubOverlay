import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { SubtitleView } from "@/components/subtitle/SubtitleView";
import { DEFAULT_PLACEMENT } from "@/shared/defaults";
import { SAMPLE_TEXT } from "@/shared/languages";
import type {
  DisplayPayload,
  OverlayModeMessage,
  OverlayPlacement,
  OverlayStyle,
} from "@/shared/types";
import { stringsFor, type OverlayStrings } from "./strings";

const SNAP_PX = 10;
const MIN_WIDTH = 0.2;
const MAX_WIDTH = 1;

type DragKind = "move" | "left" | "right";

interface DragState {
  kind: DragKind;
  startX: number;
  startY: number;
  origin: OverlayPlacement;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Full-display editing surface: a dimmed stage with the subtitle block that
 * can be dragged and resized. Positions are stored as display fractions.
 */
function EditStage({
  mode,
  display,
  style,
}: {
  mode: OverlayModeMessage;
  display: DisplayPayload;
  style: OverlayStyle;
}) {
  const t = stringsFor(mode.locale);
  const { width: vw, height: vh } = mode.viewport;
  const [placement, setPlacement] = useState<OverlayPlacement>(mode.placement);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [snapped, setSnapped] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const [blockHeight, setBlockHeight] = useState(0);

  useEffect(() => setPlacement(mode.placement), [mode.placement]);

  useEffect(() => {
    const element = blockRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBlockHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sample: DisplayPayload = useMemo(
    () =>
      display.blocks.length > 0
        ? display
        : {
            key: "sample",
            blocks: [
              { lang: mode.sampleLangs[0], role: "primary", lines: [SAMPLE_TEXT[mode.sampleLangs[0]]] },
              { lang: mode.sampleLangs[1], role: "secondary", lines: [SAMPLE_TEXT[mode.sampleLangs[1]]] },
            ],
          },
    [display, mode.sampleLangs]
  );

  const commit = useCallback((next: OverlayPlacement) => {
    void window.overlayApi.invoke("overlay:commit-placement", next);
  }, []);

  const finish = useCallback(() => {
    commit(placement);
    void window.overlayApi.invoke("overlay:set-editing", false);
  }, [commit, placement]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        finish();
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (!dx && !dy) return;
      event.preventDefault();
      setPlacement((current) => {
        const next = {
          ...current,
          x: clamp(current.x + dx / vw, current.width / 2, 1 - current.width / 2),
          y: clamp(current.y + dy / vh, 0.05, 1),
        };
        commit(next);
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, finish, vh, vw]);

  const onPointerDown = (kind: DragKind) => (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ kind, startX: event.clientX, startY: event.clientY, origin: placement });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / vw;
    const dy = (event.clientY - drag.startY) / vh;
    const origin = drag.origin;
    if (drag.kind === "move") {
      let x = clamp(origin.x + dx, origin.width / 2, 1 - origin.width / 2);
      const snap = Math.abs(x - 0.5) * vw < SNAP_PX;
      if (snap) x = 0.5;
      setSnapped(snap);
      const minY = clamp((blockHeight + 16) / vh, 0.05, 1);
      setPlacement({ ...origin, x, y: clamp(origin.y + dy, minY, 1) });
    } else {
      // Resize symmetrically around the centre so the block stays where it is.
      const delta = drag.kind === "right" ? dx : -dx;
      const width = clamp(origin.width + delta * 2, MIN_WIDTH, MAX_WIDTH);
      const x = clamp(origin.x, width / 2, 1 - width / 2);
      setPlacement({ ...origin, width, x });
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    setSnapped(false);
    commit(placement);
  };

  const left = (placement.x - placement.width / 2) * vw;
  const bottom = (1 - placement.y) * vh;
  const widthPx = placement.width * vw;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 100%, rgba(0,0,0,0.38), rgba(0,0,0,0.62))",
        cursor: drag?.kind === "move" ? "grabbing" : undefined,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Centre guide, emphasised while the block is snapped to it. */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 transition-opacity duration-150"
        style={{
          background: "rgba(255,255,255,0.9)",
          opacity: snapped ? 0.7 : 0.12,
        }}
      />

      <Toolbar
        title={t.title}
        hint={t.hint}
        widthLabel={`${t.width} ${Math.round(placement.width * 100)}%`}
        displays={mode.displays}
        displayId={placement.displayId}
        displayLabel={t.display}
        primaryLabel={t.primary}
        onDisplay={(displayId) => {
          const next = { ...placement, displayId };
          setPlacement(next);
          commit(next);
        }}
        resetLabel={t.reset}
        doneLabel={t.done}
        onReset={() => {
          const next = { ...DEFAULT_PLACEMENT, displayId: placement.displayId };
          setPlacement(next);
          commit(next);
        }}
        onDone={finish}
      />

      {mode.app ? (
        <ScopeBar
          app={mode.app}
          appScope={mode.appHasProfile}
          strings={t}
          onChange={(appScope) => {
            void window.overlayApi.invoke("overlay:app-profile", appScope, placement);
          }}
        />
      ) : null}

      <div
        ref={blockRef}
        className="group absolute"
        style={{ left, bottom, width: widthPx }}
      >
        <div
          className="relative rounded-2xl px-3 py-2 transition-[background-color,box-shadow] duration-150"
          style={{
            cursor: drag ? "grabbing" : "grab",
            background: drag ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,${drag ? 0.55 : 0.32})`,
          }}
          onPointerDown={onPointerDown("move")}
        >
          <SubtitleView display={sample} style={style} animate={false} />
          <Handle side="left" onPointerDown={onPointerDown("left")} />
          <Handle side="right" onPointerDown={onPointerDown("right")} />
        </div>
      </div>
    </div>
  );
}

/**
 * Who the edited position applies to: every program, or only the one that
 * was in front when editing started (usually the game).
 */
function ScopeBar({
  app,
  appScope,
  strings,
  onChange,
}: {
  app: string;
  appScope: boolean;
  strings: OverlayStrings;
  onChange: (appScope: boolean) => void;
}) {
  const options = [
    { value: false, label: strings.scopeAll },
    { value: true, label: app },
  ];
  return (
    <motion.div
      className="absolute top-[104px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5"
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.12, delay: 0.05 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="flex items-center gap-2 rounded-xl py-1 pr-1 pl-3 text-white"
        style={{
          background: "rgba(28,28,30,0.82)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.10), 0 8px 28px rgba(0,0,0,0.40)",
          backdropFilter: "blur(20px) saturate(160%)",
        }}
      >
        <span className="text-[12px] text-white/60">{strings.scope}</span>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/8 p-0.5">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              title={option.label}
              className="h-7 max-w-[220px] truncate rounded-md px-2.5 text-xs transition-colors"
              style={{
                background: appScope === option.value ? "rgba(255,255,255,0.22)" : "transparent",
                color: appScope === option.value ? "#fff" : "rgba(255,255,255,0.72)",
              }}
              onClick={() => option.value !== appScope && onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <span className="text-[11px] text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {appScope ? strings.scopeAppHint(app) : strings.scopeAllHint}
      </span>
    </motion.div>
  );
}

function Handle({
  side,
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (event: PointerEvent) => void;
}) {
  return (
    <div
      className="absolute top-1/2 flex h-full w-5 -translate-y-1/2 cursor-ew-resize items-center justify-center"
      style={{ [side]: -10 }}
      onPointerDown={onPointerDown}
    >
      <div className="h-9 w-1.5 rounded-full bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-transform duration-150 group-hover:scale-y-110" />
    </div>
  );
}

function Toolbar(props: {
  title: string;
  hint: string;
  widthLabel: string;
  displays: OverlayModeMessage["displays"];
  displayId: number | null;
  displayLabel: string;
  primaryLabel: string;
  onDisplay: (id: number) => void;
  resetLabel: string;
  doneLabel: string;
  onReset: () => void;
  onDone: () => void;
}) {
  const activeDisplay =
    props.displays.find((display) => display.id === props.displayId) ??
    props.displays.find((display) => display.primary);

  return (
    <motion.div
      className="absolute top-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-2xl py-2.5 pr-2.5 pl-5 text-white"
      style={{
        background: "rgba(28,28,30,0.82)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.45)",
        backdropFilter: "blur(20px) saturate(160%)",
      }}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.12 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold leading-5">{props.title}</span>
        <span className="text-[11px] leading-4 text-white/60">{props.hint}</span>
      </div>
      <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[11px] tabular-nums text-white/80">
        {props.widthLabel}
      </span>
      {props.displays.length > 1 ? (
        <div className="flex items-center gap-1 rounded-lg bg-white/8 p-0.5">
          {props.displays.map((display, index) => (
            <button
              key={display.id}
              type="button"
              title={`${props.displayLabel} ${index + 1}${display.primary ? ` · ${props.primaryLabel}` : ""}`}
              className="h-7 min-w-7 rounded-md px-2 text-xs tabular-nums transition-colors"
              style={{
                background: activeDisplay?.id === display.id ? "rgba(255,255,255,0.22)" : "transparent",
              }}
              onClick={() => props.onDisplay(display.id)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="h-8 rounded-lg px-3 text-[13px] text-white/85 transition-colors hover:bg-white/10"
          onClick={props.onReset}
        >
          {props.resetLabel}
        </button>
        <button
          type="button"
          className="h-8 rounded-lg bg-white px-4 text-[13px] font-semibold text-black transition-transform active:scale-[0.97]"
          onClick={props.onDone}
        >
          {props.doneLabel}
        </button>
      </div>
    </motion.div>
  );
}

export default EditStage;
