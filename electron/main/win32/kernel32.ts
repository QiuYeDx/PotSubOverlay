import koffi from "koffi";

const kernel32 = koffi.load("kernel32.dll");

const OpenProcess = kernel32.func(
  "void * __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)"
);
const QueryFullProcessImageNameW = kernel32.func(
  "bool __stdcall QueryFullProcessImageNameW(void *process, uint32_t flags, _Out_ uint16_t *buf, _Inout_ uint32_t *size)"
);
const CloseHandle = kernel32.func("bool __stdcall CloseHandle(void *handle)");

/** Enough to read the image name, and granted for most elevated processes too. */
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

/** Full path of a process's executable, or null when it cannot be opened (e.g. protected processes). */
export function getProcessImagePath(pid: number): string | null {
  if (!pid) return null;
  const process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (!process) return null;
  try {
    const buffer = new Uint16Array(1024);
    const size = [buffer.length];
    if (!QueryFullProcessImageNameW(process, 0, buffer, size)) return null;
    return String.fromCharCode(...buffer.subarray(0, size[0]));
  } finally {
    CloseHandle(process);
  }
}
