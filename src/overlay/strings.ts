/**
 * The overlay is a separate, lightweight page without i18next; it carries the
 * few strings it needs and receives the UI language from the main process.
 */
const STRINGS = {
  zh: {
    title: "调整字幕位置",
    hint: "拖动字幕移动 · 拖动两侧调整宽度 · 方向键微调",
    reset: "恢复默认",
    done: "完成",
    display: "显示器",
    primary: "主显示器",
    width: "宽度",
  },
  "zh-Hant": {
    title: "調整字幕位置",
    hint: "拖曳字幕移動 · 拖曳兩側調整寬度 · 方向鍵微調",
    reset: "恢復預設",
    done: "完成",
    display: "顯示器",
    primary: "主顯示器",
    width: "寬度",
  },
  en: {
    title: "Adjust Subtitle Position",
    hint: "Drag to move · Drag the edges to resize · Arrow keys to nudge",
    reset: "Reset",
    done: "Done",
    display: "Display",
    primary: "Primary",
    width: "Width",
  },
  ja: {
    title: "字幕の位置を調整",
    hint: "ドラッグで移動 · 両端をドラッグで幅を調整 · 矢印キーで微調整",
    reset: "リセット",
    done: "完了",
    display: "ディスプレイ",
    primary: "メイン",
    width: "幅",
  },
} as const;

export type OverlayLocale = keyof typeof STRINGS;
export type OverlayStrings = (typeof STRINGS)[OverlayLocale];

export function stringsFor(locale: string): OverlayStrings {
  return STRINGS[(locale in STRINGS ? locale : "zh") as OverlayLocale];
}
