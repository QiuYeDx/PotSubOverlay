import chardet from "chardet";
import iconv from "iconv-lite";

const CANDIDATES = new Set([
  "UTF-8",
  "UTF-16LE",
  "UTF-16BE",
  "GB18030",
  "Shift_JIS",
  "EUC-JP",
  "Big5",
  "EUC-KR",
  "ISO-2022-JP",
]);

/**
 * Decode subtitle bytes. BOMs and valid UTF-8 win; otherwise let chardet pick
 * among the East Asian encodings that subtitle files actually use.
 */
export function decodeSubtitle(buffer: Uint8Array): { text: string; encoding: string } {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(buffer.subarray(3)), encoding: "UTF-8 BOM" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: iconv.decode(Buffer.from(buffer.subarray(2)), "utf-16le"), encoding: "UTF-16LE" };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { text: iconv.decode(Buffer.from(buffer.subarray(2)), "utf-16be"), encoding: "UTF-16BE" };
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" };
  } catch {
    // Not UTF-8; fall through to detection.
  }

  const guesses = chardet.analyse(buffer).filter((guess) => CANDIDATES.has(guess.name));
  const encoding = guesses[0]?.name ?? "GB18030";
  const label = encoding === "UTF-8" ? "GB18030" : encoding;
  return { text: iconv.decode(Buffer.from(buffer), label), encoding: label };
}
