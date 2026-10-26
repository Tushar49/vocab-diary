/** XP and level curve (original design, tunable). */

export const XP = {
  review: 10,
  learned: 25,
  dailyGoal: 50,
  streakMilestone: 100,
} as const;

/** Cumulative XP required to *reach* level n. L2 = 150, L3 = 600, L4 = 1350, L5 = 2400… */
export function xpForLevel(n: number): number {
  return 150 * (n - 1) * (n - 1);
}

export function levelFor(totalXp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= totalXp && n < 1000) n++;
  return n;
}

export function levelProgress(totalXp: number): { level: number; into: number; span: number; total: number } {
  const level = levelFor(totalXp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, into: totalXp - floor, span: ceil - floor, total: totalXp };
}
