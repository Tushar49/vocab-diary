import type { ParsedWord } from "../types";

export interface ParseResult {
  words: ParsedWord[];
  errors: { line: number; message: string }[];
}

/** Dispatch on filename extension; falls back to line-based TXT parsing. */
export function parseImport(filename: string, content: string): ParseResult {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "json":
      return parseJson(content);
    case "csv":
      return parseCsv(content);
    case "md":
    case "markdown":
      return parseMarkdown(content);
    default:
      return parseTxt(content);
  }
}

export function parseJson(content: string): ParseResult {
  const errors: { line: number; message: string }[] = [];
  try {
    const data = JSON.parse(content);
    const arr = Array.isArray(data) ? data : Array.isArray(data?.words) ? data.words : null;
    if (!arr) return { words: [], errors: [{ line: 1, message: "Expected a JSON array (or { words: [...] })" }] };
    const words: ParsedWord[] = [];
    arr.forEach((row: Record<string, unknown>, i: number) => {
      const word = String(row.word ?? row.term ?? "").trim();
      const translation = String(row.translation ?? row.meaning ?? "").trim();
      if (!word || !translation) {
        errors.push({ line: i + 1, message: "Missing word or translation" });
        return;
      }
      words.push({
        word,
        translation,
        transcription: row.transcription != null ? String(row.transcription) : undefined,
        note: row.note != null ? String(row.note) : undefined,
        examples: Array.isArray(row.examples) ? row.examples.map(String) : undefined,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : typeof row.tags === "string" ? splitList(row.tags) : undefined,
        language: row.language != null ? String(row.language) : undefined,
        // backup-restore fidelity
        id: typeof row.id === "number" ? row.id : undefined,
        sm2: isSm2(row.sm2) ? row.sm2 : undefined,
        mastery: typeof row.mastery === "string" ? (row.mastery as ParsedWord["mastery"]) : undefined,
        createdAt: typeof row.createdAt === "number" ? row.createdAt : undefined,
        updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
      });
    });
    return { words, errors };
  } catch (e) {
    return { words: [], errors: [{ line: 1, message: `Invalid JSON: ${(e as Error).message}` }] };
  }
}

function splitList(s: string): string[] {
  return s
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isSm2(v: unknown): v is { ef: number; interval: number; reps: number; lapses: number; dueAt: number } {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.ef === "number" &&
    typeof s.interval === "number" &&
    typeof s.reps === "number" &&
    typeof s.lapses === "number" &&
    typeof s.dueAt === "number"
  );
}

/** Minimal CSV with quotes; first row may be a header. */
export function parseCsv(content: string): ParseResult {
  const errors: { line: number; message: string }[] = [];
  const rows = parseCsvRows(content);
  if (!rows.length) return { words: [], errors };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("word") || header.includes("term");
  const idx = (name: string) => header.indexOf(name);
  const wI = hasHeader ? (idx("word") >= 0 ? idx("word") : idx("term")) : 0;
  const tI = hasHeader ? (idx("translation") >= 0 ? idx("translation") : idx("meaning")) : 1;
  const trI = hasHeader ? idx("transcription") : 2;
  const nI = hasHeader ? idx("note") : 3;
  const tgI = hasHeader ? (idx("tags") >= 0 ? idx("tags") : idx("tag")) : 4;
  const lI = hasHeader ? idx("language") : -1;

  const words: ParsedWord[] = [];
  rows.slice(hasHeader ? 1 : 0).forEach((r, i) => {
    const word = (r[wI] ?? "").trim();
    const translation = (r[tI] ?? "").trim();
    if (!word || !translation) {
      errors.push({ line: i + 1, message: "Missing word or translation" });
      return;
    }
    words.push({
      word,
      translation,
      transcription: trI >= 0 ? (r[trI] || undefined) : undefined,
      note: nI >= 0 ? (r[nI] || undefined) : undefined,
      tags: tgI >= 0 && r[tgI] ? splitList(r[tgI]) : undefined,
      language: lI >= 0 && r[lI] ? r[lI].trim() : undefined,
    });
  });
  return { words, errors };
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** TXT: "word - translation" / "word — translation" / "word<TAB>translation" per line.
 *  Understands this app's own TXT export trailing metadata: [transcription] #tags // note. */
export function parseTxt(content: string): ParseResult {
  const errors: { line: number; message: string }[] = [];
  const words: ParsedWord[] = [];
  content.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const m = trimmed.match(/^(.+?)\s*(?:\t+|\s+[-–—]\s+|\s+:\s+)\s*(.+)$/);
    if (!m) {
      errors.push({ line: i + 1, message: "Expected 'word - translation'" });
      return;
    }
    let translation = m[2].trim();
    let note: string | undefined;
    let transcription: string | undefined;
    let tags: string[] | undefined;
    const noteSplit = translation.match(/^(.*?)\s*\/\/\s*(.*)$/);
    if (noteSplit) {
      translation = noteSplit[1]!;
      note = noteSplit[2]! || undefined;
    }
    const tagTail = translation.match(/\s+(#\S+(?:\s+#\S+)*)$/);
    if (tagTail) {
      const list = tagTail[1]!.split(/\s+/).map((tk) => tk.replace(/^#+/, "")).filter(Boolean);
      if (list.length) {
        tags = list;
        translation = translation.slice(0, tagTail.index!).trim();
      }
    }
    const trSplit = translation.match(/^(.*?)\s*\[([^\]]+)\]$/);
    if (trSplit) {
      translation = trSplit[1]!.trim();
      transcription = trSplit[2]!;
    }
    words.push({ word: m[1].trim(), translation, transcription, note, tags });
  });
  return { words, errors };
}

/** Markdown list items: "- **word** — translation" or "- word — translation". */
export function parseMarkdown(content: string): ParseResult {
  const errors: { line: number; message: string }[] = [];
  const words: ParsedWord[] = [];
  content.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("-")) return;
    const clean = trimmed
      .replace(/^-\s*/, "")
      .replace(/\*\*/g, "")
      .trim();
    const m = clean.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
    if (!m) {
      errors.push({ line: i + 1, message: "Expected '- word — translation'" });
      return;
    }
    words.push({ word: m[1].trim(), translation: m[2].trim() });
  });
  return { words, errors };
}

// ---------- export ----------

export type ExportFormat = "json" | "csv" | "markdown" | "txt";

export interface ExportFields {
  word: boolean;
  translation: boolean;
  transcription: boolean;
  note: boolean;
  tags: boolean;
  language: boolean;
}

export const ALL_FIELDS: ExportFields = {
  word: true,
  translation: true,
  transcription: true,
  note: true,
  tags: true,
  language: true,
};

export function exportWords(words: import("../types").Word[], format: ExportFormat, fields: ExportFields = ALL_FIELDS): string {
  if (format === "json") {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), words },
      null,
      2
    );
  }
  if (format === "csv") {
    const cols: string[] = [];
    if (fields.word) cols.push("word");
    if (fields.translation) cols.push("translation");
    if (fields.transcription) cols.push("transcription");
    if (fields.note) cols.push("note");
    if (fields.tags) cols.push("tags");
    if (fields.language) cols.push("language");
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.join(",")];
    for (const w of words) {
      const row = cols.map((c) => {
        if (c === "tags") return esc(w.tags.join(", "));
        return esc(String((w as unknown as Record<string, unknown>)[c] ?? ""));
      });
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }
  if (format === "txt") {
    return words
      .map((w) => {
        let line = `${w.word} - ${w.translation}`;
        if (fields.transcription && w.transcription) line += ` [${w.transcription}]`;
        if (fields.tags && w.tags.length) line += ` #${w.tags.map((t) => t.replace(/\s+/g, "")).join(" #")}`;
        if (fields.note && w.note) line += ` // ${w.note}`;
        return line;
      })
      .join("\n");
  }
  // markdown
  return words
    .map((w) => {
      const parts = [`**${w.word}**`];
      if (fields.translation) parts.push(w.translation);
      if (fields.transcription && w.transcription) parts.push(`[${w.transcription}]`);
      if (fields.note && w.note) parts.push(`_${w.note}_`);
      if (fields.tags && w.tags.length) parts.push(`\`#${w.tags.map((t) => t.replace(/\s+/g, "")).join(" #")}\``);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");
}
