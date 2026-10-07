import path from "node:path";
import type { PlayerBridge, PotTimes, PotWindow } from "./potplayer";

/**
 * Development-only stand-in for PotPlayer, enabled with POTSUB_FAKE_PLAYER.
 * Format: "<media path>[|<start ms>[|<duration ms>[|hold]]]". With "hold" the
 * position stays at the start (still reported as playing), which keeps one
 * subtitle on screen for documentation screenshots. Lets the UI be exercised
 * without touching the user's real player.
 */
export class FakePlayerBridge implements PlayerBridge {
  private readonly startedAt = Date.now();

  constructor(
    private readonly mediaPath: string,
    private readonly startMs: number,
    private readonly durationMs = 24 * 60_000,
    private readonly hold = false
  ) {}

  static fromEnv(value: string): FakePlayerBridge {
    const [mediaPath, start, duration, mode] = value.split("|");
    return new FakePlayerBridge(
      mediaPath,
      Number(start) || 0,
      Number(duration) || 24 * 60_000,
      mode === "hold"
    );
  }

  discover(): PotWindow[] {
    return [{ hwnd: 1n, pid: 0, title: `${path.basename(this.mediaPath)} - PotPlayer` }];
  }

  title(): string {
    return this.discover()[0].title;
  }

  queryPosition() {
    const elapsed = this.hold ? 0 : Date.now() - this.startedAt;
    const positionMs = (this.startMs + elapsed) % this.durationMs;
    return { positionMs, state: "playing" as const };
  }

  queryTimes(): PotTimes {
    return { ...this.queryPosition(), durationMs: this.durationMs };
  }

  requestPath(): Promise<string | null> {
    return Promise.resolve(this.mediaPath);
  }

  handleCopyData(): void {}

  dispose(): void {}
}
