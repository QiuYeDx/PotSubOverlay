import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, type CSSProperties } from "react";
import { FONT_STACK, HTML_LANG } from "@/shared/languages";
import type { DisplayPayload, LangRole, OverlayStyle, SubtitleLang } from "@/shared/types";
import { cn } from "@/lib/utils";

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
  animate?: boolean;
  className?: string;
}

/**
 * Renders subtitle blocks exactly like the overlay does; each block is styled
 * by its role (primary / secondary language).
 */
export function SubtitleView({ display, style, scale = 1, animate, className }: SubtitleViewProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = (animate ?? style.animation) && !reduceMotion;
  const boxed = style.background === "box";
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterIds: Record<LangRole, string | undefined> = {
    primary: needsSplit(style, "primary") ? `sub-split-${uid}-p` : undefined,
    secondary: needsSplit(style, "secondary") ? `sub-split-${uid}-s` : undefined,
  };

  return (
    <div className={cn("relative flex w-full flex-col items-center justify-end", className)}>
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
      <AnimatePresence mode="popLayout" initial={false}>
        {display.blocks.length > 0 ? (
          <motion.div
            key={display.key}
            className="flex w-full flex-col items-center text-center"
            style={{ gap: style.blockGap * scale }}
            initial={shouldAnimate ? { opacity: 0, filter: "blur(3px)", y: 3 * scale } : false}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={
              shouldAnimate
                ? { opacity: 0, filter: "blur(2px)", transition: { duration: 0.12, ease: "easeOut" } }
                : { opacity: 0, transition: { duration: 0 } }
            }
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {display.blocks.map((block, index) => (
              <div
                key={`${block.lang}-${index}`}
                lang={HTML_LANG[block.lang]}
                dir="auto"
                className="flex w-full flex-col items-center"
                style={{ gap: style.lineGap * scale }}
              >
                {block.lines.map((line, lineIndex) => {
                  const css = lineCss(block.lang, block.role, style, scale, filterIds[block.role]);
                  if (!boxed) {
                    return (
                      <span key={lineIndex} className="max-w-full whitespace-pre-wrap break-words" style={css}>
                        {line}
                      </span>
                    );
                  }
                  // The plate is its own element so a split filter never sees its colour.
                  return (
                    <span
                      key={lineIndex}
                      className="max-w-full"
                      style={{
                        background: hexToRgba(style.backgroundColor, style.backgroundOpacity),
                        borderRadius: 8 * scale,
                        padding: `${2 * scale}px ${12 * scale}px`,
                      }}
                    >
                      <span className="block whitespace-pre-wrap break-words" style={css}>
                        {line}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
