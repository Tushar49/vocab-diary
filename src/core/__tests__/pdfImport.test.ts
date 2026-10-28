import { describe, expect, it } from "vitest";
import { parsePdfLines, type PdfLine } from "../pdfImport";

const L = (text: string, size: number, page = 1): PdfLine => ({ text, size, page });

describe("parsePdfLines — this app's own PDF export layout", () => {
  it("parses entries with transcription, translation, note, examples, tags", () => {
    const r = parsePdfLines([
      L("Vocabulary Diary", 22),
      L("October 27, 2026 · 2 words", 10),
      L("ENGLISH", 10), // section label (in our export these are uppercase)
      L("resilience [ˈkeɪ.dəns]", 12),
      L("the ability to recover", 11),
      L("≈ toughness under pressure", 10),
      L("note part one", 10),
      L("note part two", 10),
      L("• she showed great resilience.", 10),
      L("• they recovered fast.", 10),
      L("#mvi #word", 9),
      L("café", 12),
      L("kaffee", 11),
      L("#cafe", 9),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.words).toHaveLength(2);
    expect(r.words[0]).toEqual({
      word: "resilience",
      translation: "the ability to recover",
      transcription: "ˈkeɪ.dəns",
      meanings: ["toughness under pressure"],
      note: "note part one note part two",
      examples: ["she showed great resilience.", "they recovered fast."],
      tags: ["mvi", "word"],
    });
    expect(r.words[1]).toEqual({ word: "café", translation: "kaffee", tags: ["cafe"] });
  });

  it("handles entry split across a page break and skips footer chrome", () => {
    const r = parsePdfLines([
      L("headword", 12),
      L("first half of translation", 11),
      L("Vocabulary Diary", 8, 2),
      L("1 / 2", 8, 2),
      L("second half of translation", 11, 2),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.words).toEqual([{ word: "headword", translation: "first half of translation second half of translation" }]);
  });

  it("reports an error when a block has no translation", () => {
    const r = parsePdfLines([L("lonely", 12), L("#tag", 9)]);
    expect(r.words).toEqual([]);
    expect(r.errors).toHaveLength(1);
  });

  it("routes wrapped-example continuation lines into the last example, not the note", () => {
    const r = parsePdfLines([
      L("word", 12),
      L("translation", 11),
      L("• first example line one", 10),
      L("continuation of the example", 10),
      L("#tag", 9),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.words[0]?.examples).toEqual(["first example line one continuation of the example"]);
    expect(r.words[0]?.translation).toBe("translation");
  });
});
