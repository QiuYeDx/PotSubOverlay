import { Tray, nativeImage } from "electron";
import { languageName } from "@/shared/languages";
import type { LangMode, LangRoles, Settings, TrayMenuState } from "@/shared/types";

type Locale = "zh" | "zh-Hant" | "en" | "ja";

const STRINGS: Record<Locale, Record<string, string>> = {
  zh: {
    open: "打开控制面板",
    showSubtitle: "显示字幕",
    editPosition: "调整字幕位置",
    language: "字幕语言",
    both: "双语",
    only: "仅{lang}",
    primary: "仅主语言",
    secondary: "仅第二语言",
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
    only: "僅{lang}",
    primary: "僅主語言",
    secondary: "僅第二語言",
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
    only: "{lang} Only",
    primary: "Primary Language Only",
    secondary: "Second Language Only",
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
    only: "{lang}のみ",
    primary: "第一言語のみ",
    secondary: "第二言語のみ",
    quit: "終了",
    hintTitle: "PotSubOverlay は実行中です",
    hintBody: "字幕は引き続き表示されます。トレイアイコンをクリックするとコントロールパネルを再度開けます。",
  },
};

export class AppTray {
  private tray: Tray;
  private locale: Locale = "zh";

  /**
   * @param openMenu Shows the styled tray menu (Windows does not let native
   *   context menus be themed, so the app draws its own).
   */
  constructor(
    iconPath: string,
    private readonly onOpen: () => void,
    private readonly openMenu: (state: TrayMenuState) => void,
    private readonly getSettings: () => Settings,
    private readonly getRoles: () => LangRoles
  ) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip("PotSubOverlay");
    this.tray.on("click", () => this.onOpen());
    this.tray.on("right-click", () => this.openMenu(this.menuState()));
  }

  setLocale(locale: string): void {
    this.locale = (locale in STRINGS ? locale : "zh") as Locale;
  }

  menuState(): TrayMenuState {
    const t = STRINGS[this.locale];
    const settings = this.getSettings();
    const roles = this.getRoles();
    const label = (value: LangMode) => {
      if (value === "both") return t.both;
      const lang = roles[value];
      return lang ? t.only.replace("{lang}", languageName(lang, this.locale)) : t[value];
    };
    return {
      labels: {
        open: t.open,
        showSubtitle: t.showSubtitle,
        editPosition: t.editPosition,
        language: t.language,
        quit: t.quit,
      },
      modes: (["both", "primary", "secondary"] as const).map((value) => ({ value, label: label(value) })),
      modesEnabled: roles.primary !== null && roles.secondary !== null,
      langMode: settings.langMode,
      overlayVisible: settings.overlayVisible,
    };
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
