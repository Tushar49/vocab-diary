/** Grade mapping between UI answers and SM-2 quality (0..5). */

export const GRADE = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type GradeKey = keyof typeof GRADE;

/** Auto-graded modes: map correctness + latency to a grade. */
export function autoGrade(correct: boolean, ms: number, slowMs = 8000): number {
  if (!correct) return 1;
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

/** Pick n distractors for multiple-choice, preferring same tags/language. */
export function pickDistractors<T extends { id?: number }>(pool: T[], answer: T, n: number, rnd = Math.random): T[] {
  const candidates = pool.filter((w) => w.id !== answer.id);
  const shuffled = [...candidates].sort(() => rnd() - 0.5);
  return shuffled.slice(0, n);
}
