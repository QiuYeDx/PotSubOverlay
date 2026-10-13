import { AnimatePresence, motion as m } from "motion/react";
import { useEffect, useId, useReducer, useRef, type CSSProperties } from "react";
import { FONT_STACK, HTML_LANG } from "@/shared/languages";
import type { DisplayPayload, LangRole, OverlayStyle, SubtitleLang } from "@/shared/types";
import { cn } from "@/lib/utils";
import { lineMotion } from "./line-motion";

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The outline is a centred text stroke painted under the fill, so half of it
 * lies inside the glyphs. An opaque fill hides that half; a translucent fill
 * would let it show through and muddy the text. In that case the line is
 * drawn in key colours (fill red, stroke green) and SplitFilter turns the two
 * channels back into fill and outline, each with its own colour and opacity,
 * so the fill never sits on top of the outline.
 */
const FILL_KEY = "#FF0000";
const RING_KEY = "#00FF00";

function needsSplit(style: OverlayStyle, role: LangRole): boolean {
  return style.outlineWidth > 0 && style[role].opacity < 1;
}

function SplitFilter({ id, style, role }: { id: string; style: OverlayStyle; role: LangRole }) {
  const [fr, fg, fb] = hexToRgb(style[role].color).map((c) => c / 255);
  const [or, og, ob] = hexToRgb(style.outlineColor).map((c) => c / 255);
  const f = style[role].opacity;
  const o = style.outlineOpacity;
  // alpha = channel + alpha - 1, clamped: 1 where that key colour is solid,
  // its antialiasing share where fill meets stroke, 0 everywhere else.
  return (
    <filter id={id} x="-40%" y="-60%" width="180%" height="220%" colorInterpolationFilters="sRGB">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        result="ring"
        values={`0 0 0 0 ${or}  0 0 0 0 ${og}  0 0 0 0 ${ob}  0 ${o} 0 ${o} ${-o}`}
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        result="fill"
        values={`0 0 0 0 ${fr}  0 0 0 0 ${fg}  0 0 0 0 ${fb}  ${f} 0 0 ${f} ${-f}`}
      />
      <feMerge>
        <feMergeNode in="ring" />
        <feMergeNode in="fill" />
      </feMerge>
    </filter>
  );
}

/** A style's font, falling back to (or, when empty, entirely using) a stack suited to the language. */
export function fontFamilyFor(family: string, lang: SubtitleLang): string {
  return family ? `"${family}", ${FONT_STACK[lang]}` : FONT_STACK[lang];
}

/** @param splitFilterId Set when the line is drawn through SplitFilter (see needsSplit). */
export function lineCss(
  lang: SubtitleLang,
  role: LangRole,
  style: OverlayStyle,
  scale = 1,
  splitFilterId?: string
): CSSProperties {
  const text = style[role];
  const size = text.fontSize * scale;
  const outline = style.outlineWidth * scale;
  const hasShadow = style.shadowBlur > 0 && style.shadowOpacity > 0;
  const shadow = (blur: number) =>
    `0 ${Math.max(1, style.shadowBlur / 4) * scale}px ${blur * scale}px ${hexToRgba("#000000", style.shadowOpacity)}`;
  const base: CSSProperties = {
    fontFamily: fontFamilyFor(text.fontFamily, lang),
    fontSize: `${size}px`,
    fontWeight: text.fontWeight,
    letterSpacing: `${style.letterSpacing * scale}px`,
    lineHeight: 1.3,
    paintOrder: "stroke fill",
  };
  if (splitFilterId) {
    return {
      ...base,
      color: FILL_KEY,
      WebkitTextStroke: `${outline * 2}px ${RING_KEY}`,
      // A text-shadow would mix into the key colours, so shadow the result instead.
      // drop-shadow follows the whole outlined shape while text-shadow follows
      // only the glyphs; half the blur gives about the same spread.
      filter: `url(#${splitFilterId})${hasShadow ? ` drop-shadow(${shadow(style.shadowBlur / 2)})` : ""}`,
    };
  }
  return {
    ...base,
    color: hexToRgba(text.color, text.opacity),
    // Stroke is painted under the fill, so the visible outline equals `outline`.
    WebkitTextStroke:
      outline > 0 ? `${outline * 2}px ${hexToRgba(style.outlineColor, style.outlineOpacity)}` : undefined,
    textShadow: hasShadow ? shadow(style.shadowBlur) : undefined,
  };
}

export interface SubtitleViewProps {
  display: DisplayPayload;
  style: OverlayStyle;
  /** Scales every size, used by the control panel previews. */
  scale?: number;
  /** false: switch lines without a transition (the edit surface's static sample). */
  animate?: boolean;
  className?: string;
}

/**
 * Keeps the previous line up through a pause shorter than `holdMs`, so two
 * lines with a tiny gap between them change in place instead of blinking out.
 */
function useBridgedDisplay(display: DisplayPayload, holdMs: number): DisplayPayload {
  const lastLine = useRef<DisplayPayload | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const empty = display.blocks.length === 0;

  // Keyed by the text, not the object: the control panel gets a new object with every snapshot.
  useEffect(() => {
    if (!empty) {
      lastLine.current = display;
      return;
    }
    if (!lastLine.current || holdMs <= 0) return;
    const timer = setTimeout(() => {
      lastLine.current = null;
      rerender();
    }, holdMs);
    return () => clearTimeout(timer);
  }, [display.key, empty, holdMs]);

  if (!empty || holdMs <= 0) return display;
  return lastLine.current ?? display;
}

/**
 * Renders subtitle blocks exactly like the overlay does; each block is styled
 * by its role (primary / secondary language).
 *
 * Lines are stacked in one grid cell aligned to the bottom, so a leaving
 * line stays exactly where it was while the next one comes in, whatever
 * their heights; the view's bottom edge never moves.
 */
export function SubtitleView({ display, style, scale = 1, animate = true, className }: SubtitleViewProps) {
  const motion = style.motion;
  const shown = useBridgedDisplay(display, animate ? motion.bridgeMs : 0);
  const line = lineMotion(animate ? motion : { ...motion, effect: "none" }, scale);
  const boxed = style.background === "box";
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterIds: Record<LangRole, string | undefined> = {
    primary: needsSplit(style, "primary") ? `sub-split-${uid}-p` : undefined,
    secondary: needsSplit(style, "secondary") ? `sub-split-${uid}-s` : undefined,
  };

  return (
    <div className={cn("relative grid w-full items-end justify-items-center", className)}>
      {filterIds.primary || filterIds.secondary ? (
        <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
          <defs>
            {(["primary", "secondary"] as const).map((role) => {
              const id = filterIds[role];
              return id ? <SplitFilter key={role} id={id} style={style} role={role} /> : null;
            })}
          </defs>
        </svg>
      ) : null}
      <AnimatePresence mode={motion.overlap === "sequential" ? "wait" : "sync"} initial={false}>
        {shown.blocks.length > 0 ? (
          <m.div
            key={shown.key}
            className="col-start-1 row-start-1 flex max-w-full flex-col items-center text-center"
            style={{
              gap: style.blockGap * scale,
              // Stay on one compositor layer, so the text does not shift by a
              // subpixel when a transition ends.
              willChange: "opacity, transform",
              ...line.style,
            }}
            initial={line.initial}
            animate={line.animate}
            exit={line.exit}
          >
            {shown.blocks.map((block, index) => (
              <div
                key={`${block.lang}-${index}`}
                lang={HTML_LANG[block.lang]}
                dir="auto"
                className="flex w-full flex-col items-center"
                style={{ gap: style.lineGap * scale }}
              >
                {block.lines.map((text, lineIndex) => {
                  const css = lineCss(block.lang, block.role, style, scale, filterIds[block.role]);
                  if (!boxed) {
                    return (
                      <span key={lineIndex} className="max-w-full whitespace-pre-wrap break-words" style={css}>
                        {text}
                      </span>
                    );
                  }
                  // The plate is its own element so a split filter never sees its colour.
                  return (
                    <span
                      key={lineIndex}
                      className="max-w-full rounded-smooth-[var(--plate-radius)]"
                      style={
                        {
                          "--plate-radius": `${8 * scale}px`,
                          background: hexToRgba(style.backgroundColor, style.backgroundOpacity),
                          padding: `${2 * scale}px ${12 * scale}px`,
                        } as CSSProperties
                      }
                    >
                      <span className="block whitespace-pre-wrap break-words" style={css}>
                        {text}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
