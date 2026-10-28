import { describe, expect, it } from "vitest";
import { tokenize, tokensForWord } from "../search";
import { parseCsv, parseJson, parseTxt, parseMarkdown, exportWords } from "../parsers";
import { looseEqual, autoGrade } from "../grades";

describe("tokenize", () => {
  it("lowercases and strips diacritics", () => {
    expect(tokenize("Héllo WÖrld")).toEqual(["hello", "world"]);
  });
  it("drops punctuation", () => {
    expect(tokenize("don't stop-me")).toEqual(["don't", "stop", "me"]);
  });
});

describe("tokensForWord", () => {
  it("indexes word, translation and tags with field tags", () => {
    const toks = tokensForWord({ word: "Resilience", translation: "Resiliencia", note: "keep going", tags: ["Work Hard"] });
    expect(toks.filter((t) => t.field === 0).map((t) => t.token)).toEqual(["resilience"]);
    expect(toks.filter((t) => t.field === 1).map((t) => t.token)).toEqual(["resiliencia", "keep", "going"]);
    expect(toks.filter((t) => t.field === 2).map((t) => t.token)).toEqual(["work", "hard"]);
  });
});

describe("parsers", () => {
  it("parses CSV with header", () => {
    const r = parseCsv("word,translation,tags\nopera,work,\"a,b\"\n");
    expect(r.errors).toHaveLength(0);
    expect(r.words[0]).toMatchObject({ word: "opera", translation: "work", tags: ["a", "b"] });
  });

  it("parses CSV without header", () => {
    const r = parseCsv("cat,gato\n");
    expect(r.words[0]).toMatchObject({ word: "cat", translation: "gato" });
  });

  it("parses JSON array", () => {
    const r = parseJson('[{"word":"x","translation":"y","tags":["t"]}]');
    expect(r.words[0]).toMatchObject({ word: "x", translation: "y", tags: ["t"] });
  });

  it("reports bad JSON", () => {
    expect(parseJson("{oops").errors.length).toBe(1);
  });

  it("parses TXT dash and tab separators", () => {
    const r = parseTxt("apple — manzana\npear\tpera");
    expect(r.words).toHaveLength(2);
  });

  it("parses Markdown list items", () => {
    const r = parseMarkdown("- **sun** — sol\n- moon — luna");
    expect(r.words).toHaveLength(2);
  });

  it("flags rows missing fields", () => {
    const r = parseTxt("onlyoneword");
    expect(r.words).toHaveLength(0);
    expect(r.errors[0].line).toBe(1);
  });
});

describe("export", () => {
  const words = [
    { id: 1, word: "a", translation: "b", transcription: "c", note: undefined, examples: [], tags: ["x"], language: "es", createdAt: 0, updatedAt: 0, sm2: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueAt: 0 }, mastery: "new" as const },
  ];
  it("exports CSV with header and rows", () => {
    const out = exportWords(words, "csv");
    expect(out).toContain("word,translation,pos,meanings,transcription,note,tags,language");
    expect(out).toContain("a,b,,,c,,x,es");
  });
  it("quotes CSV fields containing commas", () => {
    const tagged = [{ ...words[0], tags: ["x", "y,z"] }];
    expect(exportWords(tagged, "csv")).toContain('"x, y,z"');
  });
  it("exports markdown", () => {
    expect(exportWords(words, "markdown")).toContain("**a** — b");
  });
});

describe("backup round-trip", () => {
  const sm2 = { ef: 2.71, interval: 12, reps: 4, lapses: 1, dueAt: 1700000000000 };
  const word = {
    id: 7,
    word: "cadence",
    translation: "ritmo",
    transcription: "ˈkeɪ.dəns",
    note: "from running",
    examples: ["a steady cadence"],
    tags: ["sport"],
    language: "es",
    createdAt: 1690000000000,
    updatedAt: 1700000000000,
    sm2,
    mastery: "review" as const,
  };

  it("preserves sm2/mastery/timestamps through export → parse", () => {
    const json = exportWords([word as never], "json");
    const r = parseJson(json);
    expect(r.errors).toHaveLength(0);
    const p = r.words[0];
    expect(p.id).toBe(7);
    expect(p.sm2).toEqual(sm2);
    expect(p.mastery).toBe("review");
    expect(p.createdAt).toBe(1690000000000);
  });

  it("ignores malformed sm2 on restore", () => {
    const r = parseJson('[{"word":"x","translation":"y","sm2":{"ef":"bad"}}]');
    expect(r.words[0].sm2).toBeUndefined();
  });
});

describe("grades", () => {
  it("looseEqual tolerates one typo", () => {
    expect(looseEqual("hello", "helo")).toBe(true);
    expect(looseEqual("hello", "hellp")).toBe(true);
    expect(looseEqual("hello", "world")).toBe(false);
  });
  it("autoGrade maps latency", () => {
    expect(autoGrade(true, 1000)).toBe(5);
    expect(autoGrade(true, 5000)).toBe(4);
    expect(autoGrade(true, 9000)).toBe(3);
    expect(autoGrade(false, 100)).toBe(1);
  });
  it("autoGrade typo channel overrides latency", () => {
    expect(autoGrade(true, 1000, { typo: true })).toBe(3);
    expect(autoGrade(true, 9000, { typo: true })).toBe(3);
  });
});

describe('tokensForWord — meanings + pos indexed', () => {
  it('indexes additional meanings and pos as field 1', () => {
    const toks = tokensForWord({ word: 'run', translation: 'to move fast', pos: 'verb', meanings: ['to operate', 'to flow'] });
    const f1 = toks.filter((x) => x.field === 1).map((x) => x.token);
    expect(f1).toEqual(expect.arrayContaining(['operate', 'flow', 'verb', 'move']));
  });
});
