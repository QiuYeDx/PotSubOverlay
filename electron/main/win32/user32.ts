import koffi from "koffi";

/**
 * Minimal user32 bindings. Window handles cross the FFI boundary as
 * pointer-sized integers and are exposed as bigint so they can be compared,
 * stored and stringified.
 */

const user32 = koffi.load("user32.dll");

const EnumWindowsProc = koffi.proto(
  "bool __stdcall EnumWindowsProc(uintptr_t hwnd, intptr_t lParam)"
);

const EnumWindows = user32.func(
  "bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)"
);
const GetClassNameW = user32.func(
  "int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *buf, int max)"
);
const GetWindowTextW = user32.func(
  "int __stdcall GetWindowTextW(uintptr_t hwnd, _Out_ uint16_t *buf, int max)"
);
const GetWindowThreadProcessId = user32.func(
  "uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hwnd, _Out_ uint32_t *pid)"
);
const IsWindow = user32.func("bool __stdcall IsWindow(uintptr_t hwnd)");
const GetForegroundWindow = user32.func("uintptr_t __stdcall GetForegroundWindow()");
const SendMessageTimeoutW = user32.func(
  "intptr_t __stdcall SendMessageTimeoutW(uintptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ intptr_t *result)"
);
const PostMessageW = user32.func(
  "bool __stdcall PostMessageW(uintptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)"
);

const COPYDATASTRUCT = koffi.struct("COPYDATASTRUCT", {
  dwData: "uintptr_t",
  cbData: "uint32_t",
  lpData: "void *",
});

export const WM_USER = 0x0400;
export const WM_COPYDATA = 0x004a;
export const WM_COMMAND = 0x0111;
const SMTO_ABORTIFHUNG = 0x0002;

const toBigInt = (value: number | bigint) => BigInt(value);

function readWideString(buffer: Uint16Array, length: number): string {
  return String.fromCharCode(...buffer.subarray(0, Math.max(0, length)));
}

export interface TopLevelWindow {
  hwnd: bigint;
  className: string;
}

/** Enumerate top-level windows whose class name is in `classNames`. */
export function findWindowsByClass(classNames: ReadonlySet<string>): TopLevelWindow[] {
  const found: TopLevelWindow[] = [];
  const buffer = new Uint16Array(256);
  const callback = koffi.register((hwnd: number | bigint) => {
    const length = GetClassNameW(hwnd, buffer, buffer.length) as number;
    const className = readWideString(buffer, length);
    if (classNames.has(className)) found.push({ hwnd: toBigInt(hwnd), className });
    return true;
  }, koffi.pointer(EnumWindowsProc));
  try {
    EnumWindows(callback, 0);
  } finally {
    koffi.unregister(callback);
  }
  return found;
}

export function getWindowText(hwnd: bigint): string {
  const buffer = new Uint16Array(1024);
  const length = GetWindowTextW(hwnd, buffer, buffer.length) as number;
  return readWideString(buffer, length);
}

export function getWindowProcessId(hwnd: bigint): number {
  const pid = [0];
  GetWindowThreadProcessId(hwnd, pid);
  return pid[0];
}

export function isWindow(hwnd: bigint): boolean {
  return Boolean(IsWindow(hwnd));
}

export function getForegroundWindow(): bigint {
  return toBigInt(GetForegroundWindow() as number | bigint);
}

/** SendMessage with a timeout so a hung player can never freeze our main thread. */
export function sendMessageTimeout(
  hwnd: bigint,
  msg: number,
  wParam: number,
  lParam: number,
  timeoutMs = 200
): number | null {
  const result: (number | bigint)[] = [0];
  const ok = SendMessageTimeoutW(
    hwnd,
    msg,
    wParam,
    lParam,
    SMTO_ABORTIFHUNG,
    timeoutMs,
    result
  ) as number | bigint;
  if (!ok) return null;
  // PotPlayer answers with signed 32-bit values (e.g. -1 for "stopped").
  return Number(BigInt.asIntN(32, BigInt(result[0])));
}

export function postMessage(hwnd: bigint, msg: number, wParam: number, lParam: bigint): boolean {
  return Boolean(PostMessageW(hwnd, msg, wParam, lParam));
}

/** Read a WM_COPYDATA payload from the lParam buffer Electron's hookWindowMessage passes. */
export function readCopyData(lParam: Buffer): { dwData: number; bytes: Buffer } | null {
  const pointer = koffi.decode(lParam, "void *");
  if (!pointer) return null;
  const data = koffi.decode(pointer, COPYDATASTRUCT) as {
    dwData: number | bigint;
    cbData: number;
    lpData: unknown;
  };
  if (!data.lpData || data.cbData <= 0) {
    return { dwData: Number(data.dwData), bytes: Buffer.alloc(0) };
  }
  const bytes = koffi.decode(data.lpData, "uint8_t", data.cbData) as number[];
  return { dwData: Number(data.dwData), bytes: Buffer.from(bytes) };
}

/** Read the native handle Electron returns from BrowserWindow.getNativeWindowHandle(). */
export function handleFromBuffer(buffer: Buffer): bigint {
  return buffer.length >= 8 ? buffer.readBigUInt64LE(0) : BigInt(buffer.readUInt32LE(0));
}
