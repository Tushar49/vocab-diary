/** PDF import: extract text lines with font-size metadata, reconstruct word entries.
 *  Structured parser understands this app's own PDF-export layout; any other
 *  PDF falls back to raw text for the generic/AI parse paths. */
import type { ParsedWord } from "../types";
import type { ParseResult } from "./parsers";

export interface PdfLine {
  text: string;
  size: number;
  page: number;
}

/** Extract ordered text lines (top→bottom, per page) with font-size hints. */
export async function extractPdfLines(file: File): Promise<PdfLine[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  pdfjs.GlobalWorkerOptions.workerPort = workerPort;
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const out: PdfLine[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // group items into visual lines by y with tolerance, then sort left→right
      type Raw = { str?: string; transform?: number[] };
      const items = (content.items as Raw[])
        .filter((it) => typeof it.str === "string" && it.str!.trim() !== "" && Array.isArray(it.transform))
        .map((it) => ({ str: it.str!, x: it.transform![4]!, y: it.transform![5]!, size: Math.round(it.transform![3]! * 10) / 10 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines: { x: number; y: number; size: number; parts: string[] }[] = [];
      for (const it of items) {
        const prev = lines[lines.length - 1];
        if (prev && Math.abs(prev.y - it.y) <= 2) {
          prev.parts.push(it.str);
          prev.size = Math.max(prev.size, it.size);
          prev.x = Math.min(prev.x, it.x);
        } else {
          lines.push({ x: it.x, y: it.y, size: it.size, parts: [it.str] });
        }
      }
      for (const l of lines) out.push({ text: l.parts.join(" ").replace(/\s+/g, " ").trim(), size: l.size, page: p });
    }
    return out;
  } finally {
    workerPort.terminate();
  }
}

interface Draft {
  word?: string;
  transcription?: string;
  translation?: string;
  note?: string;
  tags?: string[];
  examples?: string[];
}

/** Size constants of our own PDF export (src/core/pdf.ts). */
const HEAD_MIN = 11.5;
const TITLE_MAX = 20;

/** Reconstruct entries from a PDF in this app's export layout. */
export function parsePdfLines(lines: PdfLine[]): ParseResult {
  const errors: { line: number; message: string }[] = [];
  const words: ParsedWord[] = [];
  let cur: Draft | null = null;
  let lineno = 0;

  const isHead = (l: PdfLine) => l.size >= HEAD_MIN && l.size <= TITLE_MAX;
  const flush = () => {
    if (!cur) return;
    if (cur.word && cur.translation) {
      words.push({
        word: cur.word,
        translation: cur.translation,
        transcription: cur.transcription || undefined,
        note: cur.note || undefined,
        tags: cur.tags?.length ? cur.tags : undefined,
        examples: cur.examples?.length ? cur.examples : undefined,
      });
    } else {
      errors.push({ line: lineno, message: "Entry missing headword or translation" });
    }
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    lineno++;
    const l = lines[i]!;
    const text = l.text;
    // skip chrome: cover title/date, footers
    if (l.size > TITLE_MAX || l.size <= 8.5) continue;
    if (isHead(l)) {
      flush();
      const m = text.match(/^(.*?)\s*\[(.+)\]\s*$/);
      cur = m ? { word: m[1]!.trim(), transcription: m[2]!.trim() } : { word: text.trim() };
      continue;
    }
    // section labels from our export sit immediately before a headword, uppercase
    const nextIsHead = i + 1 < lines.length && isHead(lines[i + 1]!) && text === text.toUpperCase();
    if (!cur || nextIsHead) continue;
    if (text.startsWith("#")) {
      cur.tags = [...(cur.tags ?? []), ...text.split(/\s+/).map((tk) => tk.replace(/^#+/, "")).filter(Boolean)];
    } else if (text.startsWith("•")) {
      cur.examples = [...(cur.examples ?? []), text.replace(/^•\s*/, "")];
    } else if (cur.examples?.length && !cur.tags?.length && l.size < 10.9) {
      // wrapped example continuation: our export prints notes before examples,
      // so a bare 10pt line after examples started continues the last example
      cur.examples[cur.examples.length - 1] = `${cur.examples[cur.examples.length - 1]} ${text}`;
    } else if (l.size >= 10.9) {
      // translation line (may wrap): 11pt in our export
      cur.translation = cur.translation ? `${cur.translation} ${text}` : text;
    } else {
      cur.note = cur.note ? `${cur.note} ${text}` : text;
    }
  }
  flush();
  return { words, errors };
}
