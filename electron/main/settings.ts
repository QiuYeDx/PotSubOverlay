import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { DEFAULT_SETTINGS } from "@/shared/defaults";
import { isSubtitleLang } from "@/shared/languages";
import { isPlainObject, migrateSettings, SETTINGS_VERSION } from "./settings-migrate";
import type { MediaPrefs, OverlayPlacement, PlacementProfile, Settings } from "@/shared/types";

const MAX_MEDIA_ENTRIES = 400;
const MAX_PLACEMENT_PROFILES = 100;
const SAVE_DEBOUNCE_MS = 300;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type SettingsPatch = DeepPartial<Omit<Settings, "media" | "placementProfiles" | "version">>;

/** Merge `patch` into `base`, keeping only keys that exist in `base` and matching types. */
function mergeKnown<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return base;
  const result: Record<string, unknown> = { ...base };
  for (const [key, baseValue] of Object.entries(base)) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (isPlainObject(baseValue)) {
      result[key] = mergeKnown(baseValue, value);
    } else if (
      value !== undefined &&
      (baseValue === null || value === null || typeof value === typeof baseValue)
    ) {
      result[key] = value;
    }
  }
  return result as T;
}

const finite = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;

export function sanitizePlacement(value: unknown): OverlayPlacement | null {
  if (!isPlainObject(value)) return null;
  const x = finite(value.x, 0, 1);
  const y = finite(value.y, 0, 1);
  const width = finite(value.width, 0.05, 1);
  if (x === null || y === null || width === null) return null;
  const displayId = typeof value.displayId === "number" ? value.displayId : null;
  return { displayId, x, y, width };
}

function sanitizeProfiles(value: unknown): Record<string, PlacementProfile> {
  const result: Record<string, PlacementProfile> = {};
  if (!isPlainObject(value)) return result;
  for (const [app, entry] of Object.entries(value)) {
    if (!isPlainObject(entry)) continue;
    const placement = sanitizePlacement(entry.placement);
    if (!placement) continue;
    result[app.toLowerCase()] = {
      placement,
      touched: typeof entry.touched === "number" ? entry.touched : 0,
    };
  }
  return result;
}

/** Drop values a hand-edited or older file could carry that the app cannot use. */
function sanitize(settings: Settings): Settings {
  const valid = <T extends string>(value: T, allowed: readonly string[], fallback: T): T =>
    allowed.includes(value) ? value : fallback;
  return {
    ...settings,
    version: SETTINGS_VERSION,
    primaryLang:
      isSubtitleLang(settings.primaryLang) && (settings.primaryLang as string) !== "other"
        ? settings.primaryLang
        : DEFAULT_SETTINGS.primaryLang,
    langMode: valid(settings.langMode, ["both", "primary", "secondary"], "both"),
    langOrder: valid(settings.langOrder, ["primary-first", "secondary-first"], "primary-first"),
  };
}

export class SettingsStore extends EventEmitter<{ change: [Settings, Settings] }> {
  private settings: Settings;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly filePath = path.join(app.getPath("userData"), "settings.json");

  constructor() {
    super();
    this.settings = this.load();
  }

  get(): Settings {
    return this.settings;
  }

  update(patch: SettingsPatch): Settings {
    const previous = this.settings;
    const next = mergeKnown(previous, patch);
    this.settings = sanitize({
      ...next,
      media: previous.media,
      placementProfiles: previous.placementProfiles,
    });
    this.scheduleSave();
    this.emit("change", this.settings, previous);
    return this.settings;
  }

  reset(keys: (keyof SettingsPatch)[]): Settings {
    const patch: Record<string, unknown> = {};
    for (const key of keys) patch[key] = DEFAULT_SETTINGS[key];
    return this.update(patch as SettingsPatch);
  }

  /** Remember (or, with null, forget) a program's own subtitle position. */
  setPlacementProfile(app: string, placement: OverlayPlacement | null): Settings {
    const previous = this.settings;
    const profiles = { ...previous.placementProfiles };
    const key = app.toLowerCase();
    if (placement) profiles[key] = { placement, touched: Date.now() };
    else delete profiles[key];
    const keys = Object.keys(profiles);
    if (keys.length > MAX_PLACEMENT_PROFILES) {
      keys
        .sort((a, b) => profiles[a].touched - profiles[b].touched)
        .slice(0, keys.length - MAX_PLACEMENT_PROFILES)
        .forEach((name) => delete profiles[name]);
    }
    this.settings = { ...previous, placementProfiles: profiles };
    this.scheduleSave();
    this.emit("change", this.settings, previous);
    return this.settings;
  }

  getMedia(mediaPath: string): MediaPrefs | undefined {
    return this.settings.media[mediaPath];
  }

  updateMedia(mediaPath: string, patch: Partial<Omit<MediaPrefs, "touched">>): void {
    const media = { ...this.settings.media };
    const entry = { ...media[mediaPath], ...patch, touched: Date.now() };
    delete media[mediaPath];
    media[mediaPath] = entry;
    const keys = Object.keys(media);
    if (keys.length > MAX_MEDIA_ENTRIES) {
      keys
        .sort((a, b) => media[a].touched - media[b].touched)
        .slice(0, keys.length - MAX_MEDIA_ENTRIES)
        .forEach((key) => delete media[key]);
    }
    this.settings = { ...this.settings, media };
    this.scheduleSave();
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.write();
  }

  private load(): Settings {
    try {
      const raw = migrateSettings(JSON.parse(fs.readFileSync(this.filePath, "utf8"))) as Partial<Settings>;
      const merged = mergeKnown(DEFAULT_SETTINGS, raw);
      const media = isPlainObject(raw.media) ? (raw.media as Settings["media"]) : {};
      return sanitize({ ...merged, media, placementProfiles: sanitizeProfiles(raw.placementProfiles) });
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.write();
    }, SAVE_DEBOUNCE_MS);
  }

  private write(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(this.settings, null, 2), "utf8");
      fs.renameSync(temp, this.filePath);
    } catch (error) {
      console.error("[settings] save failed", error);
    }
  }
}
