import { EventEmitter } from "node:events";
import path from "node:path";
import { getProcessImagePath } from "./win32/kernel32";
import { getForegroundWindow, getWindowProcessId } from "./win32/user32";

const POLL_MS = 300;
const MAX_CACHED_PIDS = 256;

/**
 * Windows shell surfaces (desktop, taskbar, Start, search…). Clicking them
 * does not mean the user left the game, so they never become the current app.
 */
const SHELL_PROCESSES = new Set([
  "explorer.exe",
  "shellexperiencehost.exe",
  "startmenuexperiencehost.exe",
  "searchhost.exe",
  "searchapp.exe",
  "lockapp.exe",
  "textinputhost.exe",
  "shellhost.exe",
]);

/**
 * Follows which program the user is in, for per-program subtitle positions.
 * PotPlayer, this app's own windows and shell surfaces are skipped, so
 * Alt+Tabbing to the player or opening the control panel keeps the game as
 * the current app.
 */
export class ForegroundTracker extends EventEmitter<{ change: [string | null] }> {
  private current: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly names = new Map<number, string | null>();
  private override: string | null | undefined;

  /** @param isIgnoredPid True for processes that never count (PotPlayer instances). */
  constructor(private readonly isIgnoredPid: (pid: number) => boolean) {
    super();
  }

  get app(): string | null {
    return this.current;
  }

  start(): void {
    if (this.timer) return;
    this.check();
    this.timer = setInterval(() => this.check(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** QA only: pretend this program is in front (undefined = back to the real one). */
  simulate(app: string | null | undefined): void {
    this.override = app;
    this.check();
  }

  private check(): void {
    const next = this.override !== undefined ? this.override : this.detect();
    if (next === undefined || next === this.current) return;
    this.current = next;
    this.emit("change", next);
  }

  /** undefined = keep the current app (an ignored window is in front). */
  private detect(): string | null | undefined {
    const pid = getWindowProcessId(getForegroundWindow());
    if (!pid || pid === process.pid || this.isIgnoredPid(pid)) return undefined;
    const name = this.nameOf(pid);
    if (name === "" || (name && SHELL_PROCESSES.has(name))) return undefined;
    return name;
  }

  /** Lower-case executable name; "" for this app itself, null when unreadable. */
  private nameOf(pid: number): string | null {
    if (this.names.has(pid)) return this.names.get(pid) ?? null;
    let name: string | null = null;
    try {
      const image = getProcessImagePath(pid);
      if (image && path.resolve(image).toLowerCase() === path.resolve(process.execPath).toLowerCase()) {
        name = "";
      } else {
        name = image ? path.basename(image).toLowerCase() : null;
      }
    } catch {
      name = null;
    }
    if (this.names.size >= MAX_CACHED_PIDS) this.names.clear();
    this.names.set(pid, name);
    return name;
  }
}
