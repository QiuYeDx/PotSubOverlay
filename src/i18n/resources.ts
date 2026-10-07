import type { Resource } from "i18next";
import { LangEnum } from "@/type/lang";

import enAbout from "@/locales/en/about.json";
import enAppearance from "@/locales/en/appearance.json";
import enCommon from "@/locales/en/common.json";
import enPlayer from "@/locales/en/player.json";
import enSetting from "@/locales/en/setting.json";

import jaAbout from "@/locales/ja/about.json";
import jaAppearance from "@/locales/ja/appearance.json";
import jaCommon from "@/locales/ja/common.json";
import jaPlayer from "@/locales/ja/player.json";
import jaSetting from "@/locales/ja/setting.json";

import zhAbout from "@/locales/zh/about.json";
import zhAppearance from "@/locales/zh/appearance.json";
import zhCommon from "@/locales/zh/common.json";
import zhPlayer from "@/locales/zh/player.json";
import zhSetting from "@/locales/zh/setting.json";

import zhHantAbout from "@/locales/zh-Hant/about.json";
import zhHantAppearance from "@/locales/zh-Hant/appearance.json";
import zhHantCommon from "@/locales/zh-Hant/common.json";
import zhHantPlayer from "@/locales/zh-Hant/player.json";
import zhHantSetting from "@/locales/zh-Hant/setting.json";

export const resources: Resource = {
  [LangEnum.EN]: {
    common: enCommon,
    player: enPlayer,
    appearance: enAppearance,
    about: enAbout,
    setting: enSetting,
  },
  [LangEnum.JA]: {
    common: jaCommon,
    player: jaPlayer,
    appearance: jaAppearance,
    about: jaAbout,
    setting: jaSetting,
  },
  [LangEnum.ZH]: {
    common: zhCommon,
    player: zhPlayer,
    appearance: zhAppearance,
    about: zhAbout,
    setting: zhSetting,
  },
  [LangEnum.ZH_HANT]: {
    common: zhHantCommon,
    player: zhHantPlayer,
    appearance: zhHantAppearance,
    about: zhHantAbout,
    setting: zhHantSetting,
  },
};
