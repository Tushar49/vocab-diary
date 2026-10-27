import { describe, expect, it } from "vitest";
import { exportWords, parseImport, parseTxt, ALL_FIELDS } from "../parsers";
import type { Word } from "../../types";

const w = (over: Partial<Word> = {}): Word => ({
  id: 1,
  word: "resilience",
  translation: "the ability to recover",
  transcription: "ˈkeɪ.dəns",
  note: "note here // not really", // note containing the comment marker
  examples: [],
  tags: ["mvi", "ae"],
  language: "en",
  createdAt: 0,
  updatedAt: 0,
  sm2: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueAt: 0 },
  mastery: "new",
  ...over,
});

describe("TXT round-trip", () => {
  it("export parses back word/translation/transcription/tags/note", () => {
    const txt = exportWords([w()], "txt", ALL_FIELDS);
    const r = parseImport("x.txt", txt);
    expect(r.errors).toEqual([]);
    expect(r.words[0]).toEqual({
      word: "resilience",
      translation: "the ability to recover",
      transcription: "ˈkeɪ.dəns",
      note: "note here // not really",
      tags: ["mvi", "ae"],
    });
  });

  it("plain lines without metadata stay simple", () => {
    const r = parseTxt("hola - hello\nпривет\thi");
    expect(r.errors).toEqual([]);
    expect(r.words).toEqual([
      { word: "hola", translation: "hello" },
      { word: "привет", translation: "hi" },
    ]);
  });
});

describe("CSV round-trip", () => {
  it("export parses back all fields", () => {
    const csv = exportWords([w()], "csv", ALL_FIELDS);
    const r = parseImport("x.csv", csv);
    expect(r.errors).toEqual([]);
    const g = r.words[0]!;
    expect(g.word).toBe("resilience");
    expect(g.translation).toBe("the ability to recover");
    expect(g.transcription).toBe("ˈkeɪ.dəns");
    expect(g.tags).toEqual(["mvi", "ae"]);
    expect(g.language).toBe("en");
  });
});

describe("Markdown round-trip", () => {
  it("export parses back word/translation", () => {
    const md = exportWords([w()], "markdown", ALL_FIELDS);
    const r = parseImport("x.md", md);
    // note deliberately contains '//' only; md parser splits on the first dash separator
    expect(r.words[0]!.word).toBe("resilience");
    expect(r.words[0]!.translation).toContain("the ability to recover");
  });
});
