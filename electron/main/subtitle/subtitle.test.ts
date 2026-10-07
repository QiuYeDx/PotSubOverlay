import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { composeDisplay } from "./compose";
import { decodeSubtitle } from "./decode";
import { matchSubtitleFiles, parseLangHint } from "./finder";
import { classifyLine } from "./lang";
import { normalizeCues } from "./normalize";
import { parseAss } from "./parse-ass";
import { parseLrc } from "./parse-lrc";
import { parseSrtLike } from "./parse-srt";
import { activeCues, buildTrack, selectDefaultTracks } from "./track";
import type { SubtitleCandidate } from "./finder";

const utf8 = (text: string) => new TextEncoder().encode(text);

function track(fileName: string, content: string, filterSigns = true) {
  const format = fileName.split(".").pop() as SubtitleCandidate["format"];
  const parts = fileName.split(".");
  const tag = parts.length > 2 ? parts.slice(1, -1).join(".") : "";
  return buildTrack({ path: `C:/m/${fileName}`, fileName, format, tag }, utf8(content), {
    filterSigns,
  });
}

describe("finder", () => {
  it("matches same-name, tagged and full-name subtitles only", () => {
    const media = "H:/media/Show_S01E01.mkv";
    const found = matchSubtitleFiles(media, [
      "Show_S01E01.mkv",
      "Show_S01E01.ass",
      "Show_S01E01.scjp.ass",
      "Show_S01E01.tcjp.ass",
      "show_s01e01.JA.SRT",
      "Show_S01E01.mkv.vtt",
      "Show_S01E010.ass",
      "Show_S01E02.ass",
      "cover.jpg",
    ]);
    expect(found.map((f) => [f.fileName, f.tag])).toEqual([
      ["Show_S01E01.ass", ""],
      ["Show_S01E01.scjp.ass", "scjp"],
      ["Show_S01E01.tcjp.ass", "tcjp"],
      ["show_s01e01.JA.SRT", "JA"],
      ["Show_S01E01.mkv.vtt", ""],
    ]);
  });

  it("handles media names with dots and asmr.one style names", () => {
    const found = matchSubtitleFiles("D:/a/3. Dialogue Vol.20「poco」.wav", [
      "3. Dialogue Vol.20「poco」.lrc",
      "3. Dialogue Vol.20「poco」.wav.vtt",
    ]);
    expect(found.map((f) => f.tag)).toEqual(["", ""]);
  });

  it("parses language hints from tags", () => {
    expect(parseLangHint("scjp")).toEqual({ langs: ["zh", "ja"], variant: "sc" });
    expect(parseLangHint("tc")).toEqual({ langs: ["zh"], variant: "tc" });
    expect(parseLangHint("JA")).toEqual({ langs: ["ja"], variant: null });
    expect(parseLangHint("chs&jpn")).toEqual({ langs: ["zh", "ja"], variant: "sc" });
    expect(parseLangHint("mp3")).toEqual({ langs: [], variant: null });
  });
});

describe("decode", () => {
  it("detects UTF-8, BOM, GBK and Shift-JIS", () => {
    expect(decodeSubtitle(utf8("你好")).text).toBe("你好");
    expect(decodeSubtitle(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("ok")])).text).toBe("ok");
    const sample = "今日はいい天気ですね。散歩に行きましょうか。\n明日も晴れるといいですね。";
    expect(decodeSubtitle(iconv.encode(sample, "Shift_JIS")).text).toBe(sample);
    const zh = "我们今天去公园散步吧，天气真好。\n你觉得怎么样？我觉得非常不错。";
    expect(decodeSubtitle(iconv.encode(zh, "gbk")).text).toBe(zh);
  });
});

describe("srt / vtt", () => {
  it("parses cues, strips tags and tolerates whitespace-only lines", () => {
    const cues = parseSrtLike(
      "1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Hello</i>\r\n \r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n{\\an8}上面\r\n",
      "srt"
    );
    expect(cues).toEqual([
      { start: 1000, end: 2500, lines: [{ text: "Hello", slot: "0" }] },
      { start: 3000, end: 4000, lines: [{ text: "上面", slot: "0" }] },
    ]);
  });

  it("parses webvtt with header, identifiers, notes and ruby", () => {
    const cues = parseSrtLike(
      "WEBVTT\nKind: captions\n\nNOTE hello\nworld\n\nid-1\n00:01.000 --> 00:02.000 align:start\n<ruby>漢字<rt>かんじ</rt></ruby>です\n\n00:00:03.000 --> 00:00:04.000\n<v Bob>Hi</v>\n",
      "vtt"
    );
    expect(cues.map((c) => [c.start, c.end, c.lines[0].text])).toEqual([
      [1000, 2000, "漢字です"],
      [3000, 4000, "Hi"],
    ]);
  });

  it("unrolls YouTube rolling captions", () => {
    const srt = [
      "1\n00:00:05,720 --> 00:00:07,470\n \n每个人\n",
      "2\n00:00:07,470 --> 00:00:07,480\n每个人\n \n",
      "3\n00:00:07,480 --> 00:00:10,310\n每个人\n你好，赞助人\n",
      "4\n00:00:10,310 --> 00:00:10,320\n你好，赞助人\n \n",
      "5\n00:00:10,320 --> 00:00:13,150\n你好，赞助人\n今天\n",
      "6\n00:00:13,150 --> 00:00:13,160\n今天\n \n",
      "7\n00:00:13,160 --> 00:00:21,269\n今天\n在我思考的时候，\n",
      "8\n00:00:21,269 --> 00:00:21,279\n在我思考的时候，\n \n",
      "9\n00:00:21,279 --> 00:00:25,790\n在我思考的时候，\n我想尝试一下 ASMR。\n",
    ].join("\n");
    const cues = normalizeCues(parseSrtLike(srt, "srt"));
    expect(cues.map((c) => c.lines.map((l) => l.text).join("/"))).toEqual([
      "每个人",
      "你好，赞助人",
      "今天",
      "在我思考的时候，",
      "我想尝试一下 ASMR。",
    ]);
    expect(cues[0].end).toBe(7480);
  });
});

describe("ass", () => {
  const ass = `[Script Info]
Title: test

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,50

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:04:15.49,0:04:17.24,Default,,0,0,0,,接下来将为您展现的是\\N{\\fs40\\b1}これから　ご覧に入れますのは
Dialogue: 1,0:04:15.49,0:04:17.24,Default,,0,0,0,,接下来将为您展现的是\\N{\\fs40\\b1}これから　ご覧に入れますのは
Dialogue: 0,0:04:19.83,0:04:23.32,Default,,0,0,0,,身怀秘密的 她的故事\\N{\\fs40}秘密を抱えた 彼女の話
Dialogue: 0,0:04:27.66,0:04:29.12,Default,,0,0,0,,还有五分钟就要采访了\\N{\\fs40}あと５分で取材です
Dialogue: 0,0:04:30.00,0:04:31.00,Default,,0,0,0,,大丈夫\\N大丈夫
Dialogue: 0,0:04:32.00,0:04:33.00,Default,,0,0,0,,高举双手\\N{\\fs50}you bleed yes bleed
Dialogue: 0,0:04:34.00,0:04:35.00,Sign,,0,0,0,,{\\pos(100,200)}招牌
Comment: 0,0:04:36.00,0:04:37.00,Default,,0,0,0,,注释
`;

  it("parses dialogue, strips tags, dedupes layers and flags signs", () => {
    const cues = parseAss(ass);
    expect(cues).toHaveLength(6);
    expect(cues[0]).toMatchObject({
      start: 255490,
      end: 257240,
      lines: [
        { text: "接下来将为您展现的是", slot: "Default#0" },
        { text: "これから ご覧に入れますのは", slot: "Default#1" },
      ],
    });
    expect(cues[5].isSign).toBe(true);
  });

  it("assigns languages by slot for bilingual files", () => {
    const t = track("ep.scjp.ass", ass);
    expect(t.bilingual).toBe(true);
    expect(t.cues).toHaveLength(5); // sign filtered
    const ambiguous = t.cues.find((c) => c.start === 270000)!;
    expect(ambiguous.lines.map((l) => l.lang)).toEqual(["zh", "ja"]);
    const english = t.cues.find((c) => c.start === 272000)!;
    expect(english.lines.map((l) => l.lang)).toEqual(["zh", "ja"]);
  });

  it("detects bilingual files without a tag", () => {
    expect(track("ep.ass", ass).bilingual).toBe(true);
  });
});

describe("lrc", () => {
  const lrc = `[ti:3]
[re:FasterWhisperGUI]
[offset:0]
[00:02.03]先生、待たせたわね
[00:02.03]老师，让你久等了
[00:10.77]まったく、アコたちもこんな風に
[00:10.77]真是的，亚子她们
[00:21.54]夏合宿
[00:21.54]夏季合宿
[00:22.76]そうね、あの時も確か
[00:22.76]是啊，那时候也是
[00:40.00]
`;

  it("groups same timestamps and caps duration", () => {
    const cues = parseLrc(lrc);
    expect(cues.map((c) => [c.start, c.end, c.lines.length])).toEqual([
      [2030, 10770, 2],
      [10770, 20770, 2],
      [21540, 22760, 2],
      [22760, 32760, 2],
    ]);
  });

  it("applies the offset tag and multiple timestamps", () => {
    const cues = parseLrc("[offset:500]\n[00:01.00][00:03.00]a\n[00:02.00]b\n");
    expect(cues.map((c) => [c.start, c.lines[0].text])).toEqual([
      [500, "a"],
      [1500, "b"],
      [2500, "a"],
    ]);
  });

  it("is detected as bilingual with Japanese first", () => {
    const t = track("x.lrc", lrc);
    expect(t.bilingual).toBe(true);
    const cue = t.cues.find((c) => c.start === 21540)!;
    expect(cue.lines.map((l) => l.lang)).toEqual(["ja", "zh"]);
  });
});

describe("language", () => {
  it("classifies lines", () => {
    expect(classifyLine("秘密を抱えた")).toBe("ja");
    expect(classifyLine("我们走吧")).toBe("zh");
    expect(classifyLine("大丈夫")).toBe("han");
    expect(classifyLine("you bleed")).toBe("latin");
    expect(classifyLine("……")).toBe("none");
  });

  it("treats single-language tracks as one language", () => {
    const ja = track(
      "a.srt",
      "1\n00:00:01,000 --> 00:00:02,000\nおはよう\n\n2\n00:00:03,000 --> 00:00:04,000\n大丈夫\n\n3\n00:00:05,000 --> 00:00:06,000\nいい天気ですね\n"
    );
    expect(ja.langs).toEqual(["ja"]);
    expect(ja.bilingual).toBe(false);

    const zh = track(
      "b.srt",
      "1\n00:00:01,000 --> 00:00:02,000\n早上好\n\n2\n00:00:03,000 --> 00:00:04,000\n天气真好\n"
    );
    expect(zh.langs).toEqual(["zh"]);
  });

  it("respects a single-language file tag", () => {
    const t = track("a.ja.srt", "1\n00:00:01,000 --> 00:00:02,000\n大丈夫\n");
    expect(t.langs).toEqual(["ja"]);
  });
});

describe("selection and composition", () => {
  const zh = () =>
    track("ep.zh.srt", "1\n00:00:01,000 --> 00:00:03,000\n早上好\n\n2\n00:00:04,000 --> 00:00:05,000\n再见\n");
  const ja = () =>
    track("ep.ja.srt", "1\n00:00:01,000 --> 00:00:03,000\nおはよう\n\n2\n00:00:04,500 --> 00:00:05,500\nさようなら\n");

  it("prefers a bilingual track, else zh + ja", () => {
    const sc = track("ep.scjp.ass", "[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,你好\\Nこんにちは\nDialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,再见吧\\Nさようなら\nDialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,我们走\\N行きましょう\n");
    const tc = track("ep.tcjp.ass", "[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,你好\\Nこんにちは\nDialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,再見吧\\Nさようなら\nDialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,我們走\\N行きましょう\n");
    expect(selectDefaultTracks([zh(), tc, sc], "sc").map((t) => t.fileName)).toEqual([
      "ep.scjp.ass",
    ]);
    expect(selectDefaultTracks([zh(), ja()], "sc").map((t) => t.fileName)).toEqual([
      "ep.zh.srt",
      "ep.ja.srt",
    ]);
  });

  it("merges two files and honours mode and order", () => {
    const tracks = [zh(), ja()];
    expect(composeDisplay(tracks, 2000, "both", "zh-first").blocks).toEqual([
      { lang: "zh", lines: ["早上好"] },
      { lang: "ja", lines: ["おはよう"] },
    ]);
    expect(composeDisplay(tracks, 2000, "both", "ja-first").blocks[0].lang).toBe("ja");
    expect(composeDisplay(tracks, 2000, "ja", "zh-first").blocks).toEqual([
      { lang: "ja", lines: ["おはよう"] },
    ]);
    expect(composeDisplay(tracks, 4200, "both", "zh-first").blocks).toEqual([
      { lang: "zh", lines: ["再见"] },
    ]);
    expect(composeDisplay(tracks, 9000, "both", "zh-first").key).toBe("");
  });

  it("ignores the mode for single-language subtitles", () => {
    expect(composeDisplay([zh()], 2000, "ja", "zh-first").blocks).toEqual([
      { lang: "zh", lines: ["早上好"] },
    ]);
  });

  it("finds overlapping cues", () => {
    const t = track(
      "o.srt",
      "1\n00:00:01,000 --> 00:00:10,000\n长句子\n\n2\n00:00:02,000 --> 00:00:03,000\n短句\n"
    );
    expect(activeCues(t, 2500).map((c) => c.lines[0].text)).toEqual(["长句子", "短句"]);
    expect(activeCues(t, 5000).map((c) => c.lines[0].text)).toEqual(["长句子"]);
  });
});
