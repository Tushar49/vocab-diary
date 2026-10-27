/** Grade mapping between UI answers and SM-2 quality (0..5). */

export const GRADE = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type GradeKey = keyof typeof GRADE;

/** Auto-graded modes: correctness, latency, and a typo channel. */
export function autoGrade(
  correct: boolean,
  ms: number,
  opts: { slowMs?: number; typo?: boolean } = {}
): number {
  if (!correct) return 1;
  if (opts.typo) return 3; // Levenshtein<=1 pass counts as "hard"
  const slowMs = opts.slowMs ?? 8000;
  if (ms < 3000) return 5;
  if (ms < slowMs) return 4;
  return 3;
}

/** Typing comparison: exact or single-adjacent-typo tolerance. */
export function looseEqual(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().normalize("NFC");
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  return levenshtein(x, y) <= 1;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Pick n distractors: prefer same language, then shared tags, then the rest. */
export function pickDistractors<T extends { id?: number; language?: string; tags?: string[] }>(
  pool: T[],
  answer: T,
  n: number,
  rnd = Math.random
): T[] {
  const others = pool.filter((w) => w.id !== answer.id);
  const answerTags = new Set(answer.tags ?? []);
  const sameLang: T[] = [];
  const sameTags: T[] = [];
  const rest: T[] = [];
  for (const w of others) {
    if (w.language && w.language === answer.language) sameLang.push(w);
    else if ((w.tags ?? []).some((t) => answerTags.has(t))) sameTags.push(w);
    else rest.push(w);
  }
  const shuffle = <X,>(arr: X[]) => [...arr].sort(() => rnd() - 0.5);
  return [...shuffle(sameLang), ...shuffle(sameTags), ...shuffle(rest)].slice(0, n);
}
