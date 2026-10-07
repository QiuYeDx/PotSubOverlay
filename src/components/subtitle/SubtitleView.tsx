import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import type { DisplayPayload, OverlayStyle, SubtitleLang, TextStyle } from "@/shared/types";
import { cn } from "@/lib/utils";

const FALLBACK_FONTS: Record<SubtitleLang, string> = {
  zh: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", sans-serif',
  ja: '"Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif',
  other: '"Segoe UI", system-ui, sans-serif',
};

const HTML_LANG: Record<SubtitleLang, string> = { zh: "zh-CN", ja: "ja", other: "en" };

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function textStyleFor(lang: SubtitleLang, style: OverlayStyle): TextStyle {
  // "other" (e.g. romaji or English lyrics) follows the Japanese style.
  return lang === "zh" ? style.zh : style.ja;
}

export function lineCss(
  lang: SubtitleLang,
  style: OverlayStyle,
  secondary: boolean,
  scale = 1
): CSSProperties {
  const text = textStyleFor(lang, style);
  const size = text.fontSize * (secondary ? style.secondaryScale : 1) * scale;
  const outline = style.outlineWidth * scale;
  return {
    fontFamily: `"${text.fontFamily}", ${FALLBACK_FONTS[lang]}`,
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
 * Renders subtitle blocks exactly like the overlay does. The first block is
 * the primary language; following blocks use the secondary scale.
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
                className="flex w-full flex-col items-center"
                style={{ gap: style.lineGap * scale }}
              >
                {block.lines.map((line, lineIndex) => (
                  <span
                    key={lineIndex}
                    className="max-w-full whitespace-pre-wrap break-words"
                    style={{
                      ...lineCss(block.lang, style, index > 0, scale),
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
