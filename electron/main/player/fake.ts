import path from "node:path";
import type { PlayState } from "@/shared/types";
import { POT_CMD_NEXT_KEYFRAME, type PlayerBridge, type PotTimes, type PotWindow } from "./potplayer";

/** Keyframe spacing simulated by the "keyframe" mode. */
const FAKE_GOP_MS = 8000;
/** Like PotPlayer, report the requested time for a moment while a seek is in progress. */
const FAKE_SEEK_MS = 250;

/**
 * Development-only stand-in for PotPlayer, enabled with POTSUB_FAKE_PLAYER.
 * Format: "<media path>[|<start ms>[|<duration ms>[|hold|keyframe]]]".
 * With "hold" the position stays at the start (still reported as playing),
 * which keeps one subtitle on screen for documentation screenshots;
 * "keyframe" makes seeks land on the previous keyframe, as PotPlayer does
 * with its keyframe seeking option. Seeking and pausing work like the real
 * player, so playback hotkeys can be exercised without touching the user's
 * real player.
 */
export class FakePlayerBridge implements PlayerBridge {
  /** Position at `anchorAt`; while playing the clock runs from there. */
  private anchorMs: number;
  private anchorAt = Date.now();
  private playing = true;
  private seeking: { targetMs: number; until: number } | null = null;

  constructor(
    private readonly mediaPath: string,
    startMs: number,
    private readonly durationMs = 24 * 60_000,
    private readonly hold = false,
    private readonly keyframes = false
  ) {
    this.anchorMs = startMs;
  }

  static fromEnv(value: string): FakePlayerBridge {
    const [mediaPath, start, duration, mode] = value.split("|");
    return new FakePlayerBridge(
      mediaPath,
      Number(start) || 0,
      Number(duration) || 24 * 60_000,
      mode === "hold",
      mode === "keyframe"
    );
  }

  discover(): PotWindow[] {
    return [{ hwnd: 1n, pid: 0, title: `${path.basename(this.mediaPath)} - PotPlayer` }];
  }

  title(): string {
    return this.discover()[0].title;
  }

  queryPosition() {
    if (this.seeking && Date.now() < this.seeking.until) {
      return { positionMs: this.seeking.targetMs, state: (this.playing ? "playing" : "paused") as PlayState };
    }
    const elapsed = this.playing && !this.hold ? Math.max(0, Date.now() - this.anchorAt) : 0;
    const positionMs = (this.anchorMs + elapsed) % this.durationMs;
    const state: PlayState = this.playing ? "playing" : "paused";
    return { positionMs, state };
  }

  queryTimes(): PotTimes {
    return { ...this.queryPosition(), durationMs: this.durationMs };
  }

  requestPath(): Promise<string | null> {
    return Promise.resolve(this.mediaPath);
  }

  handleCopyData(): void {}

  seek(_hwnd: bigint, positionMs: number): boolean {
    const target = this.keyframes ? Math.floor(positionMs / FAKE_GOP_MS) * FAKE_GOP_MS : positionMs;
    this.seeking = { targetMs: Math.round(positionMs), until: Date.now() + FAKE_SEEK_MS };
    this.moveTo(target, FAKE_SEEK_MS);
    return true;
  }

  setPlaying(_hwnd: bigint, playing: boolean): boolean {
    this.moveTo(this.queryPosition().positionMs);
    this.playing = playing;
    return true;
  }

  command(_hwnd: bigint, id: number): boolean {
    if (id === POT_CMD_NEXT_KEYFRAME) {
      this.moveTo((Math.floor(this.queryPosition().positionMs / FAKE_GOP_MS) + 1) * FAKE_GOP_MS);
    }
    return true;
  }

  dispose(): void {}

  /** Continue from `positionMs`, after `delayMs` (the time a seek takes). */
  private moveTo(positionMs: number, delayMs = 0): void {
    this.anchorMs = Math.max(0, Math.min(positionMs, this.durationMs - 1));
    this.anchorAt = Date.now() + delayMs;
  }
}
