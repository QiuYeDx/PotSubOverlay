export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const SETTINGS_VERSION = 3;

/**
 * Settings history:
 * - v1 (1.0.0) styled "zh" and "ja" explicitly.
 * - v2 (unreleased) styles the primary and secondary language instead.
 * - v3 (1.1.0) moves the text-size and outline defaults; values still at the
 *   1.0 defaults were never chosen by the user, so they follow the new ones.
 */
export function migrateSettings(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  const version = typeof raw.version === "number" ? raw.version : 1;
  if (version >= SETTINGS_VERSION) return raw;
  const next: Record<string, unknown> = { ...raw, version: SETTINGS_VERSION };
  const style = isPlainObject(raw.style) ? { ...raw.style } : null;

  if (version < 2) {
    if (style && (isPlainObject(style.zh) || isPlainObject(style.ja))) {
      const zh = isPlainObject(style.zh) ? style.zh : {};
      const ja = isPlainObject(style.ja) ? style.ja : {};
      const scale = typeof style.secondaryScale === "number" ? style.secondaryScale : 0.74;
      const jaSize = typeof ja.fontSize === "number" ? ja.fontSize : 34;
      // The 1.0 default fonts become "auto" so other languages get a suitable face.
      style.primary = { ...zh, fontFamily: zh.fontFamily === "Microsoft YaHei UI" ? "" : zh.fontFamily };
      style.secondary = {
        ...ja,
        fontFamily: ja.fontFamily === "Yu Gothic UI" ? "" : ja.fontFamily,
        fontSize: Math.round(jaSize * scale),
      };
    }
    const modes: Record<string, string> = { zh: "primary", ja: "secondary" };
    if (typeof raw.langMode === "string" && modes[raw.langMode]) next.langMode = modes[raw.langMode];
    const orders: Record<string, string> = { "zh-first": "primary-first", "ja-first": "secondary-first" };
    if (typeof raw.langOrder === "string" && orders[raw.langOrder]) {
      next.langOrder = orders[raw.langOrder];
    }
  }

  if (style) {
    const primary = isPlainObject(style.primary) ? { ...style.primary } : null;
    const secondary = isPlainObject(style.secondary) ? { ...style.secondary } : null;
    if (primary && primary.fontSize === 34) primary.fontSize = 30;
    if (secondary && secondary.fontSize === 25) secondary.fontSize = 24;
    if (style.outlineWidth === 3) style.outlineWidth = 1.5;
    if (primary) style.primary = primary;
    if (secondary) style.secondary = secondary;
    next.style = style;
  }
  return next;
}
