import type { PlayState } from "@/shared/types";
import {
  findWindowsByClass,
  getWindowProcessId,
  getWindowText,
  postMessage,
  readCopyData,
  sendMessageTimeout,
  WM_USER,
} from "../win32/user32";

/**
 * PotPlayer remote-control messages (WM_USER + code), as documented in
 * PotPlayer's SDK header and verified against PotPlayer 64-bit.
 */
const POT_GET_TOTAL_TIME = 0x5002;
const POT_GET_CURRENT_TIME = 0x5004;
const POT_GET_PLAY_STATUS = 0x5006;
/** Replies asynchronously with WM_COPYDATA (dwData = 0x6020, UTF-8 path). */
const POT_GET_PLAYFILE_NAME = 0x6020;

const WINDOW_CLASSES = new Set(["PotPlayer64", "PotPlayer"]);
const PATH_REQUEST_TIMEOUT_MS = 400;

export interface PotWindow {
  hwnd: bigint;
  pid: number;
  title: string;
}

export interface PotTimes {
  positionMs: number;
  durationMs: number;
  state: PlayState;
}

function toState(code: number | null): PlayState | null {
  if (code === null) return null;
  if (code === 2) return "playing";
  if (code === 1) return "paused";
  return "stopped";
}

/** What PlayerMonitor needs from a player; implemented by PotPlayer and the dev fake. */
export interface PlayerBridge {
  discover(): PotWindow[];
  title(hwnd: bigint): string;
  queryPosition(hwnd: bigint): { positionMs: number; state: PlayState } | null;
  queryTimes(hwnd: bigint): PotTimes | null;
  requestPath(hwnd: bigint): Promise<string | null>;
  handleCopyData(lParam: Buffer): void;
  dispose(): void;
}

interface PathRequest {
  hwnd: bigint;
  resolve: (path: string | null) => void;
}

export class PotPlayerBridge implements PlayerBridge {
  private queue: PathRequest[] = [];
  private pending: (PathRequest & { timer: NodeJS.Timeout }) | null = null;

  /** @param replyHwnd A window of ours that receives WM_COPYDATA replies. */
  constructor(private readonly replyHwnd: bigint) {}

  discover(): PotWindow[] {
    return findWindowsByClass(WINDOW_CLASSES).map(({ hwnd }) => ({
      hwnd,
      pid: getWindowProcessId(hwnd),
      title: getWindowText(hwnd),
    }));
  }

  title(hwnd: bigint): string {
    return getWindowText(hwnd);
  }

  queryPosition(hwnd: bigint): { positionMs: number; state: PlayState } | null {
    const position = sendMessageTimeout(hwnd, WM_USER, POT_GET_CURRENT_TIME, 0);
    const state = toState(sendMessageTimeout(hwnd, WM_USER, POT_GET_PLAY_STATUS, 0));
    if (position === null || state === null) return null;
    return { positionMs: Math.max(0, position), state };
  }

  queryTimes(hwnd: bigint): PotTimes | null {
    const now = this.queryPosition(hwnd);
    const duration = sendMessageTimeout(hwnd, WM_USER, POT_GET_TOTAL_TIME, 0);
    if (!now || duration === null) return null;
    return { ...now, durationMs: Math.max(0, duration) };
  }

  /**
   * Ask PotPlayer for the full path of the file it is playing. Requests are
   * serialised because the reply does not say which window sent it.
   */
  requestPath(hwnd: bigint): Promise<string | null> {
    return new Promise((resolve) => {
      this.queue.push({ hwnd, resolve });
      this.pump();
    });
  }

  /** Feed WM_COPYDATA messages received by `replyHwnd` into the bridge. */
  handleCopyData(lParam: Buffer): void {
    const pending = this.pending;
    if (!pending) return;
    const data = readCopyData(lParam);
    if (!data || data.dwData !== POT_GET_PLAYFILE_NAME) return;
    const path = data.bytes.toString("utf8").replace(/\0+$/, "").trim();
    this.settle(path || null);
  }

  dispose(): void {
    if (this.pending) this.settle(null);
    for (const request of this.queue.splice(0)) request.resolve(null);
  }

  private pump(): void {
    if (this.pending) return;
    const next = this.queue.shift();
    if (!next) return;
    const timer = setTimeout(() => this.settle(null), PATH_REQUEST_TIMEOUT_MS);
    this.pending = { ...next, timer };
    // PostMessage, not SendMessage: PotPlayer answers with a nested SendMessage
    // that would otherwise re-enter our message loop during the FFI call.
    if (!postMessage(next.hwnd, WM_USER, POT_GET_PLAYFILE_NAME, this.replyHwnd)) {
      this.settle(null);
    }
  }

  private settle(path: string | null): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(path);
    this.pump();
  }
}
