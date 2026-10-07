import { useEffect, useRef, useState, type ReactNode } from "react";
import { SubtitleView } from "@/components/subtitle/SubtitleView";
import type { DisplayPayload, OverlayPlacement, OverlayStyle } from "@/shared/types";
import { cn } from "@/lib/utils";

/**
 * A small "screen" that previews subtitles with the real overlay renderer.
 * The text is scaled to the stage the same way it would sit on the display,
 * clamped so it stays legible in small stages.
 */
export function SubtitleStage({
  display,
  style,
  placement,
  minScale = 0.42,
  maxScale = 1,
  className,
  children,
  placeholder,
}: {
  display: DisplayPayload;
  style: OverlayStyle;
  placement: OverlayPlacement;
  minScale?: number;
  maxScale?: number;
  className?: string;
  /** Chrome drawn above the subtitle (status chips, progress…). */
  children?: ReactNode;
  /** Shown centred when there is nothing to display. */
  placeholder?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const realWidth = Math.max(640, window.screen.width * placement.width);
  const scale = width > 0 ? Math.min(maxScale, Math.max(minScale, width / realWidth)) : minScale;
  const empty = display.blocks.length === 0;

  return (
    <div
      ref={ref}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-[#0b0d12] text-white",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
        className
      )}
    >
      {/* Soft, game-like backdrop so outline and shadow read as they would in use. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 80% at 18% 22%, rgba(88,112,255,0.28), transparent 70%)," +
            "radial-gradient(50% 70% at 82% 30%, rgba(255,120,170,0.20), transparent 70%)," +
            "radial-gradient(70% 60% at 55% 110%, rgba(64,200,170,0.20), transparent 70%)," +
            "linear-gradient(180deg, #151a26 0%, #0b0d12 100%)",
        }}
      />
      {children}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[var(--stage-pad,18px)]">
        <SubtitleView display={display} style={style} scale={scale} />
      </div>
      {empty && placeholder ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-white/45">
          {placeholder}
        </div>
      ) : null}
    </div>
  );
}
