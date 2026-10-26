import type { Mastery, Sm2State } from "../types";

/**
 * Clean-room SuperMemo-2 implementation from the published algorithm.
 * grade q: 0..5 (lapse below 3). `interval` is in days; 0 = relearn in ~10 min.
 */
export function gradeSm2(state: Sm2State, q: number, now = Date.now()): Sm2State {
  const clamped = Math.max(0, Math.min(5, Math.round(q)));
  const ef = Math.max(1.3, state.ef + (0.1 - (5 - clamped) * (0.08 + (5 - clamped) * 0.02)));

  if (clamped < 3) {
    return { ef, interval: 0, reps: 0, lapses: state.lapses + 1, dueAt: now + 10 * 60_000 };
  }

  let interval: number;
  if (state.reps === 0) interval = 1;
  else if (state.reps === 1) interval = 6;
  else interval = Math.min(365, Math.round((state.interval || 1) * ef));

  // ±5% fuzz so bulk items don't clump
  const fuzz = 1 + (Math.random() * 0.1 - 0.05);
  interval = Math.max(1, Math.round(interval * fuzz));

  return { ef, interval, reps: state.reps + 1, lapses: state.lapses, dueAt: now + interval * 86_400_000 };
}

const DAY = 86_400_000;

/** Five-segment mastery meter derived from the scheduling interval. */
export function masteryPips(sm2: Sm2State): number {
  const iv = sm2.interval * DAY;
  return [DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY].filter((t) => iv >= t).length;
}

export function computeMastery(sm2: Sm2State, hasBeenReviewed: boolean, forceReview = false): Mastery {
  if (!hasBeenReviewed) return "new";
  if (forceReview) return "review";
  if (sm2.interval >= 21) return "mastered";
  if (sm2.interval >= 3 && sm2.reps >= 2) return "review";
  return "learning";
}
