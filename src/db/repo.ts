import type { DailyStat, Mastery, ParsedWord, ReviewMode, Settings, Sm2State, Word } from "../types";
import { DEFAULT_SETTINGS, newSm2 } from "../types";
import { db } from "./db";
import { gradeSm2, computeMastery } from "../core/sm2";
import { tokensForWord, tokenize } from "../core/search";
import { XP } from "../core/xp";
import { todayKey } from "../core/date";

// ---------- settings ----------

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get("settings");
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: "settings", value: s });
}

// ---------- search index ----------

async function indexWord(id: number, w: Word): Promise<void> {
  await db.searchIndex.where("wordId").equals(id).delete();
  const rows = tokensForWord(w).map((t) => ({ token: t.token, wordId: id, field: t.field }));
  if (rows.length) await db.searchIndex.bulkPut(rows);
}

async function unindexWord(id: number): Promise<void> {
  await db.searchIndex.where("wordId").equals(id).delete();
}

// ---------- words CRUD ----------

export interface WordInput {
  word: string;
  translation: string;
  transcription?: string;
  note?: string;
  examples?: string[];
  tags?: string[];
  language?: string;
}

function normalizeTags(tags?: string[]): string[] {
  return [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
}

export async function createWord(input: WordInput): Promise<number> {
  const now = Date.now();
  const w: Word = {
    word: input.word.trim(),
    translation: input.translation.trim(),
    transcription: input.transcription?.trim() || undefined,
    note: input.note?.trim() || undefined,
    examples: input.examples ?? [],
    tags: normalizeTags(input.tags),
    language: input.language?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    sm2: newSm2(),
    mastery: "new",
  };
  const id = (await db.words.add(w)) as number;
  await indexWord(id, w);
  return id;
}

export async function updateWord(id: number, patch: WordInput & { sm2?: Sm2State; mastery?: Mastery }): Promise<void> {
  const existing = await db.words.get(id);
  if (!existing) return;
  const next: Word = {
    ...existing,
    word: (patch.word ?? existing.word).trim(),
    translation: (patch.translation ?? existing.translation).trim(),
    transcription: patch.transcription !== undefined ? patch.transcription.trim() || undefined : existing.transcription,
    note: patch.note !== undefined ? patch.note.trim() || undefined : existing.note,
    examples: patch.examples ?? existing.examples,
    tags: patch.tags ? normalizeTags(patch.tags) : existing.tags,
    language: patch.language !== undefined ? patch.language.trim() || undefined : existing.language,
    sm2: patch.sm2 ?? existing.sm2,
    mastery: patch.mastery ?? existing.mastery,
    updatedAt: Date.now(),
  };
  await db.words.put(next);
  await indexWord(id, next);
}

export async function deleteWord(id: number): Promise<void> {
  await db.words.delete(id);
  await unindexWord(id);
}

export async function getWord(id: number): Promise<Word | undefined> {
  return db.words.get(id);
}

export type SortKey = "recent" | "alpha" | "due";

export interface ListOptions {
  query?: string;
  tags?: string[];
  language?: string;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

export async function listWords(opts: ListOptions = {}): Promise<Word[]> {
  const { query, tags, language, sort = "recent", limit = 60, offset = 0 } = opts;
  let ranked: Word[] | null = null;

  if (query && query.trim()) {
    const tokens = tokenize(query);
    if (tokens.length) {
      const scores = new Map<number, number>();
      for (const tk of tokens) {
        const rows = await db.searchIndex.where("token").startsWith(tk).toArray();
        for (const r of rows) {
          const base = r.token === tk ? 3 : r.field === 2 ? 1 : 2;
          scores.set(r.wordId, (scores.get(r.wordId) ?? 0) + base);
        }
      }
      const ids = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      ranked = (await db.words.bulkGet(ids)).filter((w): w is Word => !!w);
    } else {
      ranked = [];
    }
  }

  let collection: Word[];
  if (ranked) collection = ranked;
  else if (language) collection = await db.words.where("language").equals(language).toArray();
  else collection = await db.words.toArray();

  if (tags && tags.length) {
    const wanted = new Set(tags);
    collection = collection.filter((w) => w.tags.some((t) => wanted.has(t)));
  }

  if (sort === "alpha") collection.sort((a, b) => a.word.localeCompare(b.word));
  else if (sort === "due") collection.sort((a, b) => (a.sm2.dueAt || Infinity) - (b.sm2.dueAt || Infinity));
  else if (!ranked) collection.sort((a, b) => b.updatedAt - a.updatedAt);

  return collection.slice(offset, offset + limit);
}

export async function countWords(): Promise<number> {
  return db.words.count();
}

export async function allTags(): Promise<{ name: string; count: number }[]> {
  const words = await db.words.toArray();
  const counts = new Map<string, number>();
  for (const w of words) for (const t of w.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export async function allLanguages(): Promise<string[]> {
  const words = await db.words.toArray();
  return [...new Set(words.map((w) => w.language).filter((l): l is string => !!l))].sort();
}

// ---------- study ----------

export interface QueueEntry {
  word: Word;
  isNew: boolean;
}

export async function buildQueue(settings: Settings, now = Date.now()): Promise<QueueEntry[]> {
  const words = await db.words.toArray();
  const today = await db.daily.get(todayKey(settings.dayStartHour, now));
  const reviewedToday = today?.reviews ?? 0;
  const learnedToday = today?.learned ?? 0;

  const due = words
    .filter((w) => w.mastery !== "new" && w.sm2.dueAt > 0 && w.sm2.dueAt <= now)
    .sort((a, b) => a.sm2.dueAt - b.sm2.dueAt)
    .slice(0, Math.max(0, settings.maxReviewsPerDay - reviewedToday))
    .map((w) => ({ word: w, isNew: false }));

  const newRoom = Math.max(0, settings.newPerDay - learnedToday);
  const fresh = words
    .filter((w) => w.mastery === "new")
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, newRoom)
    .map((w) => ({ word: w, isNew: true }));

  return [...fresh, ...due];
}

export interface ReviewOutcome {
  xpGained: number;
  learned: boolean;
  hitGoal: boolean;
}

export async function recordReview(
  word: Word,
  mode: ReviewMode,
  grade: number,
  ms: number,
  settings: Settings,
  now = Date.now()
): Promise<ReviewOutcome> {
  const wasNew = word.mastery === "new";
  const sm2 = gradeSm2(word.sm2, grade, now);
  const lapsed = word.mastery === "mastered" && grade < 3;
  const mastery = computeMastery(sm2, true, lapsed);
  const updated: Word = { ...word, sm2, mastery, updatedAt: now };
  const learned = wasNew && grade >= 3;
  const key = todayKey(settings.dayStartHour, now);

  let xpGained = XP.review + (learned ? XP.learned : 0);
  let hitGoal = false;

  await db.transaction("rw", db.words, db.reviews, db.daily, async () => {
    await db.words.put(updated);
    await db.reviews.add({ wordId: updated.id!, at: now, mode, grade, correct: grade >= 3, ms });
    const stat: DailyStat = (await db.daily.get(key)) ?? { date: key, learned: 0, reviews: 0, xp: 0 };
    stat.reviews += 1;
    if (learned) stat.learned += 1;
    stat.xp += xpGained;
    if (stat.reviews === settings.dailyGoal) {
      stat.xp += XP.dailyGoal;
      xpGained += XP.dailyGoal;
      hitGoal = true;
    }
    await db.daily.put(stat);
  });

  return { xpGained, learned, hitGoal };
}

export async function totalXp(): Promise<number> {
  const all = await db.daily.toArray();
  return all.reduce((sum, d) => sum + d.xp, 0);
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export async function streakInfo(dayStartHour: number, now = Date.now()): Promise<{ current: number; best: number }> {
  const rows = await db.daily.toArray();
  const active = new Set(rows.filter((r) => r.reviews > 0).map((r) => r.date));
  if (!active.size) return { current: 0, best: 0 };

  let current = 0;
  const cursor = new Date(now);
  for (;;) {
    if (active.has(todayKey(dayStartHour, cursor.getTime()))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  const sorted = [...active].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    run = prev && nextDayKey(prev) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return { current, best };
}

export interface HistoryRow {
  word: Word;
  lastReviewAt: number | null;
}

export async function wordHistory(limit = 100): Promise<HistoryRow[]> {
  const reviews = await db.reviews.orderBy("at").reverse().limit(500).toArray();
  const last = new Map<number, number>();
  for (const r of reviews) if (!last.has(r.wordId)) last.set(r.wordId, r.at);
  const words = (await db.words.bulkGet([...last.keys()])).filter((w): w is Word => !!w);
  return words
    .map((w) => ({ word: w, lastReviewAt: last.get(w.id!) ?? null }))
    .sort((a, b) => (b.lastReviewAt ?? 0) - (a.lastReviewAt ?? 0))
    .slice(0, limit);
}

export async function monthCalendar(year: number, month0: number): Promise<DailyStat[]> {
  const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}-`;
  const all = await db.daily.toArray();
  return all.filter((d) => d.date.startsWith(prefix));
}

// ---------- import / export ----------

export type DuplicatePolicy = "skip" | "merge" | "replace";

export interface ImportSummary {
  added: number;
  merged: number;
  replaced: number;
  skipped: number;
}

export async function importWords(parsed: ParsedWord[], policy: DuplicatePolicy = "skip"): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, merged: 0, replaced: 0, skipped: 0 };
  const now = Date.now();
  for (const p of parsed) {
    const word = p.word.trim();
    if (!word) {
      summary.skipped++;
      continue;
    }
    const dupe = await db.words.where("word").equals(word).first();
    if (dupe) {
      if (policy === "skip") {
        summary.skipped++;
      } else if (policy === "merge") {
        const merged: Word = {
          ...dupe,
          translation: dupe.translation || p.translation,
          transcription: dupe.transcription || p.transcription,
          note: dupe.note || p.note,
          examples: [...new Set([...dupe.examples, ...(p.examples ?? [])])],
          tags: [...new Set([...dupe.tags, ...(p.tags ?? [])])],
          language: dupe.language ?? p.language,
          updatedAt: now,
        };
        await db.words.put(merged);
        await indexWord(merged.id!, merged);
        summary.merged++;
      } else {
        const replaced: Word = {
          ...dupe,
          translation: p.translation,
          transcription: p.transcription,
          note: p.note,
          examples: p.examples ?? [],
          tags: normalizeTags(p.tags),
          language: p.language,
          updatedAt: now,
        };
        await db.words.put(replaced);
        await indexWord(replaced.id!, replaced);
        summary.replaced++;
      }
    } else {
      await createWord(p);
      summary.added++;
    }
  }
  return summary;
}

export async function deleteAllData(): Promise<void> {
  await db.transaction("rw", db.words, db.reviews, db.daily, db.searchIndex, async () => {
    await Promise.all([db.words.clear(), db.reviews.clear(), db.daily.clear(), db.searchIndex.clear()]);
  });
}
