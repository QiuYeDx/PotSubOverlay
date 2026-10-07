import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { FONT_STACK, HTML_LANG } from "@/shared/languages";
import type { DisplayPayload, LangRole, OverlayStyle, SubtitleLang } from "@/shared/types";
import { cn } from "@/lib/utils";

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A style's font, falling back to (or, when empty, entirely using) a stack suited to the language. */
export function fontFamilyFor(family: string, lang: SubtitleLang): string {
  return family ? `"${family}", ${FONT_STACK[lang]}` : FONT_STACK[lang];
}

export function lineCss(
  lang: SubtitleLang,
  role: LangRole,
  style: OverlayStyle,
  scale = 1
): CSSProperties {
  const text = style[role];
  const size = text.fontSize * scale;
  const outline = style.outlineWidth * scale;
  return {
    fontFamily: fontFamilyFor(text.fontFamily, lang),
    fontSize: `${size}px`,
    fontWeight: text.fontWeight,
    color: text.color,
    letterSpacing: `${style.letterSpacing * scale}px`,
    lineHeight: 1.3,
    // Stroke is painted under the fill, so the visible outline equals `outline`.
    WebkitTextStroke: outline > 0 ? `${outline * 2}px ${style.outlineColor}` : undefined,
    paintOrder: "stroke fill",
    textShadow:
      style.shadowBlur > 0 && style.shadowOpacity > 0
        ? `0 ${Math.max(1, style.shadowBlur / 4) * scale}px ${style.shadowBlur * scale}px ${hexToRgba("#000000", style.shadowOpacity)}`
        : undefined,
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

  return (
    <div className={cn("relative flex w-full flex-col items-center justify-end", className)}>
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
                {block.lines.map((line, lineIndex) => (
                  <span
                    key={lineIndex}
                    className="max-w-full whitespace-pre-wrap break-words"
                    style={{
                      ...lineCss(block.lang, block.role, style, scale),
                      ...(boxed
                        ? {
                            background: hexToRgba(style.backgroundColor, style.backgroundOpacity),
                            borderRadius: 8 * scale,
                            padding: `${2 * scale}px ${12 * scale}px`,
                            boxDecorationBreak: "clone",
                            WebkitBoxDecorationBreak: "clone",
                          }
                        : null),
                    }}
                  >
                    {line}
                  </span>
                ))}
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
