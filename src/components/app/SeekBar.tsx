import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** After a seek, keep showing the target until the player reports a position this close to it. */
const LAND_TOLERANCE_MS = 1500;
/** …or until this long has passed (the player may land somewhere else, e.g. on a keyframe). */
const LAND_TIMEOUT_MS = 2500;

interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  /** Arrow keys move by this much. */
  stepMs: number;
  disabled?: boolean;
  label: string;
  /** "card": on the player card, theme colours; "stage": inside the dark preview stage. */
  tone?: "card" | "stage";
  className?: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Playback progress that can be clicked or dragged to seek. The bar thickens
 * and shows a handle on hover; while dragging, a bubble shows the time under
 * the pointer and the seek is sent on release. Afterwards the bar stays on
 * the target until the player catches up, so it never snaps back.
 */
export function SeekBar({
  positionMs,
  durationMs,
  onSeek,
  stepMs,
  disabled = false,
  label,
  tone = "card",
  className,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, setPending] = useState<{ ratio: number; at: number } | null>(null);
  const usable = !disabled && durationMs > 0;

  // Let go of the target once the player has arrived (or after a while).
  useEffect(() => {
    if (!pending) return;
    if (Math.abs(positionMs - pending.ratio * durationMs) < LAND_TOLERANCE_MS) {
      setPending(null);
      return;
    }
    const timer = setTimeout(() => setPending(null), Math.max(0, pending.at + LAND_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [pending, positionMs, durationMs]);

  const ratioAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const seek = (ratio: number) => {
    setPending({ ratio, at: Date.now() });
    onSeek(Math.round(ratio * durationMs));
  };

  const live = usable ? clamp01(positionMs / durationMs) : 0;
  const shown = drag ?? pending?.ratio ?? live;
  const pointer = drag ?? hover;
  // Follow playback smoothly, but track the pointer and seeks exactly.
  const follow = drag === null && pending === null;
  const active = usable && (hover !== null || drag !== null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!usable || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    setDrag(ratioAt(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!usable) return;
    const ratio = ratioAt(event.clientX);
    if (drag !== null) setDrag(ratio);
    else if (event.pointerType === "mouse") setHover(ratio);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const ratio = ratioAt(event.clientX);
    setDrag(null);
    seek(ratio);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!usable) return;
    const delta = event.key === "ArrowLeft" ? -stepMs : event.key === "ArrowRight" ? stepMs : 0;
    if (!delta) return;
    event.preventDefault();
    seek(clamp01((shown * durationMs + delta) / durationMs));
  };

  const stage = tone === "stage";

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round((shown * durationMs) / 1000)}
      aria-valuetext={usable ? `${formatTime(shown * durationMs)} / ${formatTime(durationMs)}` : undefined}
      aria-disabled={!usable}
      tabIndex={usable ? 0 : -1}
      className={cn(
        "group/seek relative flex h-4 touch-none items-center outline-none select-none",
        usable ? "cursor-pointer" : "pointer-events-none",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div
        ref={trackRef}
        className={cn(
          "relative w-full overflow-hidden rounded-full transition-[height] duration-150 ease-out",
          active ? "h-[5px]" : "h-[3px]",
          stage ? "bg-white/15" : "bg-muted",
          "group-focus-visible/seek:h-[5px]"
        )}
      >
        {/* Where the pointer is: a faint preview of the seek. */}
        {pointer !== null && drag === null ? (
          <div
            className={cn("absolute inset-y-0 left-0 origin-left", stage ? "bg-white/20" : "bg-foreground/15")}
            style={{ width: "100%", transform: `scaleX(${pointer})` }}
          />
        ) : null}
        <div
          className={cn(
            "absolute inset-y-0 left-0 origin-left",
            stage ? "bg-white/70" : "bg-foreground/70",
            follow && "transition-transform duration-200 ease-linear"
          )}
          style={{ width: "100%", transform: `scaleX(${shown})` }}
        />
      </div>

      {usable ? (
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.25)]",
            stage ? "bg-white" : "bg-foreground",
            active ? "scale-100 opacity-100" : "scale-50 opacity-0",
            "group-focus-visible/seek:scale-100 group-focus-visible/seek:opacity-100"
          )}
          style={{
            left: `${shown * 100}%`,
            transition: `opacity 150ms ease-out, scale 150ms ease-out${follow ? ", left 200ms linear" : ""}`,
          }}
        />
      ) : null}

      {usable && pointer !== null ? (
        <div
          className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 rounded-smooth-sm bg-foreground px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-background shadow-sm"
          style={{ left: `clamp(24px, ${pointer * 100}%, calc(100% - 24px))` }}
        >
          {formatTime(pointer * durationMs)}
        </div>
      ) : null}
    </div>
  );
}
