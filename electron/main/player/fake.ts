import path from "node:path";
import type { PlayerBridge, PotTimes, PotWindow } from "./potplayer";

/**
 * Development-only stand-in for PotPlayer, enabled with POTSUB_FAKE_PLAYER.
 * Format: "<media path>" or "<media path>|<start ms>". Lets the UI be
 * exercised without touching the user's real player.
 */
export class FakePlayerBridge implements PlayerBridge {
  private readonly startedAt = Date.now();

  constructor(
    private readonly mediaPath: string,
    private readonly startMs: number,
    private readonly durationMs = 24 * 60_000
  ) {}

  static fromEnv(value: string): FakePlayerBridge {
    const [mediaPath, start] = value.split("|");
    return new FakePlayerBridge(mediaPath, Number(start) || 0);
  }

  discover(): PotWindow[] {
    return [{ hwnd: 1n, pid: 0, title: `${path.basename(this.mediaPath)} - PotPlayer` }];
  }

  title(): string {
    return this.discover()[0].title;
  }

  queryPosition() {
    const positionMs = (this.startMs + Date.now() - this.startedAt) % this.durationMs;
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
