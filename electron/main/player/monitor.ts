import { EventEmitter } from "node:events";
import type { PlayerInstance, PlayState } from "@/shared/types";
import { getForegroundWindow, getWindowProcessId } from "../win32/user32";
import type { PlayerBridge } from "./potplayer";

const DISCOVERY_INTERVAL_MS = 1000;
const POLL_PLAYING_MS = 50;
const POLL_IDLE_MS = 250;
const FOREGROUND_INTERVAL_MS = 250;

interface TrackedInstance extends PlayerInstance {
  hwnd: bigint;
  /** When this instance last switched into "playing"; drives auto selection. */
  playingSince: number;
  pathRequestedFor: string;
}

export interface MonitorEvents {
  instances: [PlayerInstance[]];
  active: [PlayerInstance | null];
  media: [string | null];
  tick: [{ positionMs: number; durationMs: number; state: PlayState }];
  foreground: [boolean];
}

/**
 * Tracks every PotPlayer window, decides which one the overlay follows and
 * polls that one's position at a high rate.
 */
export class PlayerMonitor extends EventEmitter<MonitorEvents> {
  private instances = new Map<string, TrackedInstance>();
  private activeId: string | null = null;
  private manualId: string | null = null;
  private activeMedia: string | null = null;
  private foregroundIsPlayer = false;
  private timers: NodeJS.Timeout[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private stopped = true;

  constructor(private readonly bridge: PlayerBridge) {
    super();
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.discover();
    this.timers.push(setInterval(() => this.discover(), DISCOVERY_INTERVAL_MS));
    this.timers.push(setInterval(() => this.checkForeground(), FOREGROUND_INTERVAL_MS));
    this.schedulePoll(0);
  }

  stop(): void {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.bridge.dispose();
  }

  get selection(): "auto" | "manual" {
    return this.manualId ? "manual" : "auto";
  }

  get currentId(): string | null {
    return this.activeId;
  }

  get isPlayerForeground(): boolean {
    return this.foregroundIsPlayer;
  }

  list(): PlayerInstance[] {
    return [...this.instances.values()].map(publicView);
  }

  active(): PlayerInstance | null {
    const instance = this.activeId ? this.instances.get(this.activeId) : undefined;
    return instance ? publicView(instance) : null;
  }

  /** Pin the overlay to one PotPlayer window, or pass null to follow automatically. */
  select(id: string | null): void {
    this.manualId = id && this.instances.has(id) ? id : null;
    this.updateActive();
  }

  /** Re-read the active instance's file path (e.g. after the user asks to rescan). */
  refreshPath(): void {
    const instance = this.activeId ? this.instances.get(this.activeId) : undefined;
    if (instance) void this.fetchPath(instance);
  }

  private discover(): void {
    let windows;
    try {
      windows = this.bridge.discover();
    } catch (error) {
      console.error("[monitor] discover failed", error);
      return;
    }

    const seen = new Set<string>();
    let changed = false;
    for (const window of windows) {
      const id = window.hwnd.toString();
      seen.add(id);
      const times = this.bridge.queryTimes(window.hwnd);
      let instance = this.instances.get(id);
      if (!instance) {
        instance = {
          id,
          hwnd: window.hwnd,
          pid: window.pid,
          title: window.title,
          mediaPath: null,
          durationMs: times?.durationMs ?? 0,
          positionMs: times?.positionMs ?? 0,
          state: times?.state ?? "stopped",
          playingSince: times?.state === "playing" ? Date.now() : 0,
          pathRequestedFor: "",
        };
        this.instances.set(id, instance);
        changed = true;
      } else {
        if (instance.title !== window.title) changed = true;
        instance.title = window.title;
        if (times) {
          if (Math.abs(instance.durationMs - times.durationMs) > 1000) changed = true;
          this.applyState(instance, times.state);
          instance.durationMs = times.durationMs;
          if (instance.id !== this.activeId) instance.positionMs = times.positionMs;
        }
      }

      // The window title carries the file name; a change means a new file.
      const fingerprint = `${instance.title}|${Math.round(instance.durationMs / 1000)}`;
      if (instance.pathRequestedFor !== fingerprint) {
        instance.pathRequestedFor = fingerprint;
        void this.fetchPath(instance);
      }
    }

    for (const id of [...this.instances.keys()]) {
      if (!seen.has(id)) {
        this.instances.delete(id);
        if (this.manualId === id) this.manualId = null;
        changed = true;
      }
    }

    this.updateActive();
    // Instances are re-broadcast every second so progress and state stay fresh.
    this.emit("instances", this.list());
    if (changed) this.emitMediaIfChanged();
  }

  private async fetchPath(instance: TrackedInstance): Promise<void> {
    const path = await this.bridge.requestPath(instance.hwnd);
    const current = this.instances.get(instance.id);
    if (!current) return;
    if (current.durationMs <= 0 && current.state === "stopped") {
      current.mediaPath = null;
    } else if (path) {
      current.mediaPath = path;
    } else if (!current.mediaPath) {
      // No answer (player busy or loading): retry on the next discovery pass.
      current.pathRequestedFor = "";
    }
    this.emit("instances", this.list());
    this.emitMediaIfChanged();
  }

  private applyState(instance: TrackedInstance, state: PlayState): void {
    if (state === "playing" && instance.state !== "playing") instance.playingSince = Date.now();
    instance.state = state;
  }

  private updateActive(): void {
    let next: TrackedInstance | undefined;
    if (this.manualId) next = this.instances.get(this.manualId);
    if (!next) {
      const all = [...this.instances.values()];
      const playing = all.filter((instance) => instance.state === "playing");
      const current = this.activeId ? this.instances.get(this.activeId) : undefined;
      if (current && current.state === "playing") next = current;
      else if (playing.length > 0) {
        next = playing.sort((a, b) => b.playingSince - a.playingSince)[0];
      } else if (current) next = current;
      else next = all.sort((a, b) => b.playingSince - a.playingSince)[0];
    }
    const nextId = next?.id ?? null;
    if (nextId !== this.activeId) {
      this.activeId = nextId;
      this.emit("active", this.active());
      this.emitMediaIfChanged();
      this.schedulePoll(0);
    }
  }

  private emitMediaIfChanged(): void {
    const media = this.active()?.mediaPath ?? null;
    if (media !== this.activeMedia) {
      this.activeMedia = media;
      this.emit("media", media);
    }
  }

  private schedulePoll(delay: number): void {
    if (this.stopped) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.poll(), delay);
  }

  private poll(): void {
    const instance = this.activeId ? this.instances.get(this.activeId) : undefined;
    if (!instance) {
      this.schedulePoll(POLL_IDLE_MS);
      return;
    }
    const now = this.bridge.queryPosition(instance.hwnd);
    if (now) {
      this.applyState(instance, now.state);
      instance.positionMs = now.positionMs;
      this.emit("tick", {
        positionMs: now.positionMs,
        durationMs: instance.durationMs,
        state: now.state,
      });
    }
    this.schedulePoll(instance.state === "playing" ? POLL_PLAYING_MS : POLL_IDLE_MS);
  }

  private checkForeground(): void {
    let isPlayer = false;
    if (this.instances.size > 0) {
      const pid = getWindowProcessId(getForegroundWindow());
      for (const instance of this.instances.values()) {
        if (instance.pid === pid) {
          isPlayer = true;
          break;
        }
      }
    }
    if (isPlayer !== this.foregroundIsPlayer) {
      this.foregroundIsPlayer = isPlayer;
      this.emit("foreground", isPlayer);
    }
  }
}

function publicView(instance: TrackedInstance): PlayerInstance {
  return {
    id: instance.id,
    pid: instance.pid,
    title: instance.title,
    mediaPath: instance.mediaPath,
    durationMs: instance.durationMs,
    positionMs: instance.positionMs,
    state: instance.state,
  };
}
