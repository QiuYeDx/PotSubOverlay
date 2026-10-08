import type { OverlayToast } from "@/shared/types";

/**
 * The overlay is a separate, lightweight page without i18next; it carries the
 * few strings it needs and receives the UI language from the main process.
 */
interface Strings {
  title: string;
  hint: string;
  reset: string;
  done: string;
  display: string;
  primary: string;
  width: string;
  /** Edit mode: who the position applies to. */
  scope: string;
  scopeAll: string;
  scopeAllHint: string;
  scopeAppHint: (app: string) => string;
  recall: (depth: number) => string;
  toast: Record<OverlayToast["kind"], (seconds: number) => string>;
}

const STRINGS: Record<"zh" | "zh-Hant" | "en" | "ja", Strings> = {
  zh: {
    title: "调整字幕位置",
    hint: "拖动字幕移动 · 拖动两侧调整宽度 · 方向键微调",
    reset: "恢复默认",
    done: "完成",
    display: "显示器",
    primary: "主显示器",
    width: "宽度",
    scope: "用于",
    scopeAll: "所有程序",
    scopeAllHint: "没有单独位置的程序都使用这个位置",
    scopeAppHint: (app) => `只在 ${app} 处于前台时使用这个位置`,
    recall: (depth) => (depth <= 1 ? "上一句" : `前 ${depth} 句`),
    toast: {
      pause: () => "已暂停",
      play: () => "继续播放",
      replay: () => "重听这一句",
      back: (s) => `后退 ${s} 秒`,
      forward: (s) => `前进 ${s} 秒`,
      noPlayer: () => "没有连接 PotPlayer",
      noLine: () => "没有可用的字幕",
    },
  },
  "zh-Hant": {
    title: "調整字幕位置",
    hint: "拖曳字幕移動 · 拖曳兩側調整寬度 · 方向鍵微調",
    reset: "恢復預設",
    done: "完成",
    display: "顯示器",
    primary: "主顯示器",
    width: "寬度",
    scope: "用於",
    scopeAll: "所有程式",
    scopeAllHint: "沒有單獨位置的程式都使用這個位置",
    scopeAppHint: (app) => `只在 ${app} 位於前景時使用這個位置`,
    recall: (depth) => (depth <= 1 ? "上一句" : `前 ${depth} 句`),
    toast: {
      pause: () => "已暫停",
      play: () => "繼續播放",
      replay: () => "重聽這一句",
      back: (s) => `倒退 ${s} 秒`,
      forward: (s) => `快轉 ${s} 秒`,
      noPlayer: () => "沒有連接 PotPlayer",
      noLine: () => "沒有可用的字幕",
    },
  },
  en: {
    title: "Adjust Subtitle Position",
    hint: "Drag to move · Drag the edges to resize · Arrow keys to nudge",
    reset: "Reset",
    done: "Done",
    display: "Display",
    primary: "Primary",
    width: "Width",
    scope: "Use for",
    scopeAll: "All apps",
    scopeAllHint: "Used by every app without a position of its own",
    scopeAppHint: (app) => `Used only while ${app} is in front`,
    recall: (depth) => (depth <= 1 ? "Previous line" : `${depth} lines back`),
    toast: {
      pause: () => "Paused",
      play: () => "Playing",
      replay: () => "Replaying this line",
      back: (s) => `Back ${s}s`,
      forward: (s) => `Forward ${s}s`,
      noPlayer: () => "PotPlayer is not connected",
      noLine: () => "No subtitle line here",
    },
  },
  ja: {
    title: "字幕の位置を調整",
    hint: "ドラッグで移動 · 両端をドラッグで幅を調整 · 矢印キーで微調整",
    reset: "リセット",
    done: "完了",
    display: "ディスプレイ",
    primary: "メイン",
    width: "幅",
    scope: "適用先",
    scopeAll: "すべてのアプリ",
    scopeAllHint: "専用の位置がないアプリはこの位置を使います",
    scopeAppHint: (app) => `${app} が前面にあるときだけ使います`,
    recall: (depth) => (depth <= 1 ? "ひとつ前" : `${depth} つ前`),
    toast: {
      pause: () => "一時停止",
      play: () => "再生",
      replay: () => "このセリフをもう一度",
      back: (s) => `${s} 秒戻る`,
      forward: (s) => `${s} 秒進む`,
      noPlayer: () => "PotPlayer に接続していません",
      noLine: () => "字幕がありません",
    },
  },
};

export type OverlayStrings = Strings;

export function stringsFor(locale: string): OverlayStrings {
  return STRINGS[(locale in STRINGS ? locale : "zh") as keyof typeof STRINGS];
}
