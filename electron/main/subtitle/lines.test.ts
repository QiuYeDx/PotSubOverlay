import { describe, expect, it } from "vitest";
import { composeDisplay } from "./compose";
import { lineAt, lineBefore, linesBefore } from "./lines";
import { buildTrack } from "./track";
import type { SubtitleCandidate } from "./finder";

const utf8 = (text: string) => new TextEncoder().encode(text);

function track(fileName: string, content: string) {
  const format = fileName.split(".").pop() as SubtitleCandidate["format"];
  const parts = fileName.split(".");
  const tag = parts.length > 2 ? parts.slice(1, -1).join(".") : "";
  return buildTrack({ path: `C:/m/${fileName}`, fileName, format, tag }, utf8(content), {
    filterSigns: true,
  });
}

const srt = (cues: [string, string, string][]) =>
  cues.map(([start, end, text], i) => `${i + 1}\n00:00:${start} --> 00:00:${end}\n${text}\n`).join("\n");

// Chinese and Japanese in two files, each language starting a little apart.
const zh = track(
  "ep.zh.srt",
  srt([
    ["01,000", "03,000", "第一句"],
    ["04,000", "06,000", "第二句"],
    ["07,000", "09,000", "第三句"],
  ])
);
const ja = track(
  "ep.ja.srt",
  srt([
    ["01,080", "03,000", "一つ目"],
    ["03,900", "06,000", "二つ目"],
    ["07,050", "09,000", "三つ目"],
  ])
);
const tracks = [zh, ja];
const compose = (time: number) => composeDisplay(tracks, time, "both", "primary-first", "zh");

describe("line navigation", () => {
  it("finds the line on screen and where it starts", () => {
    expect(lineAt(tracks, 5000)).toEqual({ startMs: 3900, probeMs: 5000 });
    expect(lineAt(tracks, 6500)).toBeNull();
  });

  it("steps to the previous line across both languages", () => {
    // From the second line (starting 3.9s), the previous one starts at 1.0s.
    expect(lineBefore(tracks, 3900)?.startMs).toBe(1000);
    // In the gap after the second line, "previous" is the second line itself.
    expect(lineBefore(tracks, 6500)?.startMs).toBe(3900);
    expect(lineBefore(tracks, 1000)).toBeNull();
  });

  it("lists earlier lines newest first, skipping the current one", () => {
    const current = compose(8000);
    const lines = linesBefore(tracks, lineAt(tracks, 8000)!.startMs, 5, compose, current.key);
    expect(lines.map((line) => line.startMs)).toEqual([3900, 1000]);
    expect(lines[0].display.blocks.map((block) => block.lines[0])).toEqual(["第二句", "二つ目"]);
  });
});
