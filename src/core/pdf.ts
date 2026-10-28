/** PDF export via jsPDF (dynamic import keeps it out of the main bundle).
 *  Roboto TTFs are embedded so IPA transcriptions and Cyrillic/Greek render correctly
 *  (jsPDF's built-in fonts are Latin-1 only). */
import type { Word } from "../types";
import robotoRegularUrl from "../assets/fonts/Roboto-Regular.ttf?url";
import robotoBoldUrl from "../assets/fonts/Roboto-Bold.ttf?url";
import robotoItalicUrl from "../assets/fonts/Roboto-RegularItalic.ttf?url";

type JsPdf = import("jspdf").jsPDF;

let fontsLoaded = false;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function ensureFonts(doc: JsPdf): Promise<void> {
  if (fontsLoaded) return;
  const sources: [string, string][] = [
    ["normal", robotoRegularUrl],
    ["bold", robotoBoldUrl],
    ["italic", robotoItalicUrl],
  ];
  for (const [style, url] of sources) {
    const res = await fetch(url);
    const b64 = arrayBufferToBase64(await res.arrayBuffer());
    doc.addFileToVFS(`Roboto-${style}.ttf`, b64);
    doc.addFont(`Roboto-${style}.ttf`, "Roboto", style);
  }
  fontsLoaded = true;
}

export async function exportPdf(words: Word[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = 0;

  const footer = () => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Vocabulary Diary", margin, pageH - 24);
      doc.text(`${p} / ${total}`, pageW - margin, pageH - 24, { align: "right" });
    }
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (s: string, size: number, style: "normal" | "bold" | "italic", color: [number, number, number], lineH: number) => {
    if (!s.trim()) return;
    doc.setFont("Roboto", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, contentW) as string[];
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
  };

  // cover header
  doc.setFont("Roboto", "bold");
  doc.setFontSize(22);
  doc.setTextColor(42, 33, 24);
  doc.text("Vocabulary Diary", margin, 72);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  doc.text(`${date}  ·  ${words.length} words`, margin, 90);
  doc.setDrawColor(220, 205, 185);
  doc.line(margin, 102, pageW - margin, 102);
  y = 126;

  // group by language when any word carries one
  const langs = [...new Set(words.map((w) => w.language).filter(Boolean))] as string[];
  const groups: { label: string; items: Word[] }[] = langs.length
    ? [...langs.sort().map((l) => ({ label: l, items: words.filter((w) => w.language === l) })), { label: "other", items: words.filter((w) => !w.language) }].filter((g) => g.items.length)
    : [{ label: "", items: words }];

  const INK: [number, number, number] = [42, 33, 24];
  const SOFT: [number, number, number] = [107, 93, 79];
  const FAINT: [number, number, number] = [150, 138, 122];

  for (const g of groups) {
    if (g.label) {
      ensureSpace(40);
      text(g.label.toUpperCase(), 10, "bold", FAINT, 18);
      y += 4;
    }
    for (const w of g.items) {
      ensureSpace(46);
      // headword + transcription
      doc.setFont("Roboto", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...INK);
      const head = w.word;
      const headW = doc.getTextWidth(head);
      ensureSpace(18);
      doc.text(head, margin, y);
      if (w.transcription) {
        doc.setFont("Roboto", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...FAINT);
        doc.text(`[${w.transcription}]`, margin + headW + 8, y);
      }
      y += 16;
      text(w.translation, 11, "normal", SOFT, 15);
      if (w.meanings?.length) text(w.meanings.map((m) => `≈ ${m}`).join("\n"), 10, "normal", SOFT, 14);
      if (w.note) text(w.note, 10, "italic", SOFT, 14);
      if (w.examples.length) text(w.examples.slice(0, 3).map((e) => `• ${e}`).join("\n"), 10, "normal", FAINT, 14);
      if (w.tags.length) text(w.tags.map((t) => `#${t.replace(/\s+/g, "")}`).join("  "), 9, "normal", FAINT, 13);
      y += 8;
      ensureSpace(8);
      doc.setDrawColor(236, 228, 218);
      doc.line(margin, y - 4, pageW - margin, y - 4);
      y += 8;
    }
  }

  footer();
  return doc.output("blob");
}
