import { Menu, Tray, nativeImage } from "electron";
import type { LangMode, Settings } from "@/shared/types";

type Locale = "zh" | "zh-Hant" | "en" | "ja";

const STRINGS: Record<Locale, Record<string, string>> = {
  zh: {
    open: "打开控制面板",
    showSubtitle: "显示字幕",
    editPosition: "调整字幕位置",
    language: "字幕语言",
    both: "双语",
    zh: "仅中文",
    ja: "仅日文",
    quit: "退出",
    hintTitle: "PotSubOverlay 仍在运行",
    hintBody: "字幕会继续显示。点击托盘图标可重新打开控制面板。",
  },
  "zh-Hant": {
    open: "開啟控制面板",
    showSubtitle: "顯示字幕",
    editPosition: "調整字幕位置",
    language: "字幕語言",
    both: "雙語",
    zh: "僅中文",
    ja: "僅日文",
    quit: "結束",
    hintTitle: "PotSubOverlay 仍在執行",
    hintBody: "字幕會繼續顯示。點擊系統匣圖示可重新開啟控制面板。",
  },
  en: {
    open: "Open Control Panel",
    showSubtitle: "Show Subtitles",
    editPosition: "Adjust Subtitle Position",
    language: "Subtitle Language",
    both: "Bilingual",
    zh: "Chinese Only",
    ja: "Japanese Only",
    quit: "Quit",
    hintTitle: "PotSubOverlay is still running",
    hintBody: "Subtitles keep working. Click the tray icon to reopen the control panel.",
  },
  ja: {
    open: "コントロールパネルを開く",
    showSubtitle: "字幕を表示",
    editPosition: "字幕の位置を調整",
    language: "字幕の言語",
    both: "二か国語",
    zh: "中国語のみ",
    ja: "日本語のみ",
    quit: "終了",
    hintTitle: "PotSubOverlay は実行中です",
    hintBody: "字幕は引き続き表示されます。トレイアイコンをクリックするとコントロールパネルを再度開けます。",
  },
};

export interface TrayActions {
  open: () => void;
  toggleOverlay: () => void;
  edit: () => void;
  setLangMode: (mode: LangMode) => void;
  quit: () => void;
}

export class AppTray {
  private tray: Tray;
  private locale: Locale = "zh";

  constructor(
    iconPath: string,
    private readonly actions: TrayActions,
    private getSettings: () => Settings
  ) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip("PotSubOverlay");
    this.tray.on("click", () => actions.open());
    this.refresh();
  }

  setLocale(locale: string): void {
    const next = (locale in STRINGS ? locale : "zh") as Locale;
    if (next === this.locale) return;
    this.locale = next;
    this.refresh();
  }

  refresh(): void {
    const t = STRINGS[this.locale];
    const settings = this.getSettings();
    const mode = (value: LangMode) => ({
      label: t[value],
      type: "radio" as const,
      checked: settings.langMode === value,
      click: () => this.actions.setLangMode(value),
    });
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t.open, click: () => this.actions.open() },
        { type: "separator" },
        {
          label: t.showSubtitle,
          type: "checkbox",
          checked: settings.overlayVisible,
          click: () => this.actions.toggleOverlay(),
        },
        { label: t.editPosition, click: () => this.actions.edit() },
        { label: t.language, submenu: [mode("both"), mode("zh"), mode("ja")] },
        { type: "separator" },
        { label: t.quit, click: () => this.actions.quit() },
      ])
    );
  }

  /** One-time native balloon explaining that closing the window keeps the app alive. */
  showRunningHint(): void {
    const t = STRINGS[this.locale];
    this.tray.displayBalloon({ title: t.hintTitle, content: t.hintBody, iconType: "info" });
  }

  destroy(): void {
    this.tray.destroy();
  }
}
