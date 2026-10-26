/** Tokenisation + search index helpers. Diacritic- and case-insensitive. */

export interface IndexedToken {
  token: string;
  field: 0 | 1 | 2; // 0=word, 1=translation/transcription/note, 2=tag
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function tokenize(input: string): string[] {
  return stripDiacritics(input.toLowerCase())
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function tokensForWord(w: {
  word: string;
  translation?: string;
  transcription?: string;
  note?: string;
  tags?: string[];
}): IndexedToken[] {
  const out: IndexedToken[] = [];
  for (const t of tokenize(w.word)) out.push({ token: t, field: 0 });
  for (const t of tokenize([w.translation, w.transcription, w.note].filter(Boolean).join(" ")))
    out.push({ token: t, field: 1 });
  for (const tag of w.tags ?? []) for (const t of tokenize(tag)) out.push({ token: t, field: 2 });
  return out;
}
