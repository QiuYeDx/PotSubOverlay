import koffi from "koffi";

const dwmapi = koffi.load("dwmapi.dll");

const DwmSetWindowAttribute = dwmapi.func(
  "int32_t __stdcall DwmSetWindowAttribute(uintptr_t hwnd, uint32_t attribute, _In_ int32_t *value, uint32_t size)"
);

const DWMWA_TRANSITIONS_FORCEDISABLED = 3;

/**
 * Turn off the shell's show/hide animations for a window. Without this,
 * Windows fades the overlay in on its own schedule, which fights the
 * renderer's fade and looks like a stutter.
 */
export function disableWindowTransitions(hwnd: bigint): boolean {
  try {
    return DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, [1], 4) === 0;
  } catch {
    return false;
  }
}
