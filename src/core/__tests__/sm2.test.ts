import { describe, expect, it } from "vitest";
import { gradeSm2, computeMastery, masteryPips } from "../sm2";
import { newSm2 } from "../../types";

const DAY = 86_400_000;

describe("gradeSm2", () => {
  it("graduates a new word: first pass = 1 day", () => {
    const s = gradeSm2(newSm2(), 4, 1_000_000);
    expect(s.reps).toBe(1);
    expect(s.interval).toBe(1);
    expect(s.dueAt).toBe(1_000_000 + 1 * DAY);
  });

  it("second pass = 6 days", () => {
    const s = gradeSm2({ ef: 2.5, interval: 1, reps: 1, lapses: 0, dueAt: 0 }, 4, 0);
    expect(s.reps).toBe(2);
    expect(s.interval).toBe(6);
  });

  it("third pass multiplies by ef", () => {
    const s = gradeSm2({ ef: 2.5, interval: 6, reps: 2, lapses: 0, dueAt: 0 }, 4, 0);
    expect(s.reps).toBe(3);
    expect(s.interval).toBeGreaterThanOrEqual(13); // 6*2.5=15, ±5% fuzz
    expect(s.interval).toBeLessThanOrEqual(17);
  });

  it("lapse resets reps and schedules ~10 min relearn", () => {
    const s = gradeSm2({ ef: 2.5, interval: 21, reps: 4, lapses: 0, dueAt: 0 }, 1, 5_000_000);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.interval).toBe(0);
    expect(s.dueAt).toBe(5_000_000 + 10 * 60_000);
  });

  it("clamps ef at 1.3", () => {
    let s = newSm2();
    for (let i = 0; i < 30; i++) s = gradeSm2({ ...s, interval: 1, reps: 2, dueAt: 0 }, 0, 0);
    expect(s.ef).toBe(1.3);
  });

  it("caps interval at 365 days", () => {
    let s: ReturnType<typeof newSm2> = { ef: 3.2, interval: 360, reps: 20, lapses: 0, dueAt: 0 };
    s = gradeSm2(s, 5, 0);
    expect(s.interval).toBeLessThanOrEqual(365);
  });

  it("rejects out-of-range grades", () => {
    const s = gradeSm2(newSm2(), 99, 0);
    expect(s.reps).toBe(1); // 99 clamps to 5 → pass
  });
});

describe("computeMastery", () => {
  it("new when never reviewed", () => {
    expect(computeMastery(newSm2(), false)).toBe("new");
  });

  it("learning early on", () => {
    expect(computeMastery({ ef: 2.5, interval: 1, reps: 1, lapses: 0, dueAt: 0 }, true)).toBe("learning");
  });

  it("review after interval >= 3 and reps >= 2", () => {
    expect(computeMastery({ ef: 2.5, interval: 6, reps: 2, lapses: 0, dueAt: 0 }, true)).toBe("review");
  });

  it("mastered at interval >= 21", () => {
    expect(computeMastery({ ef: 2.5, interval: 30, reps: 5, lapses: 0, dueAt: 0 }, true)).toBe("mastered");
  });

  it("forceReview demotes mastered on lapse", () => {
    expect(computeMastery({ ef: 2.5, interval: 30, reps: 5, lapses: 1, dueAt: 0 }, true, true)).toBe("review");
  });
});

describe("masteryPips", () => {
  it("maps intervals to 0..5 pips", () => {
    expect(masteryPips(newSm2())).toBe(0);
    expect(masteryPips({ ef: 2.5, interval: 1, reps: 1, lapses: 0, dueAt: 0 })).toBe(1);
    expect(masteryPips({ ef: 2.5, interval: 5, reps: 2, lapses: 0, dueAt: 0 })).toBe(2);
    expect(masteryPips({ ef: 2.5, interval: 10, reps: 3, lapses: 0, dueAt: 0 })).toBe(3);
    expect(masteryPips({ ef: 2.5, interval: 30, reps: 4, lapses: 0, dueAt: 0 })).toBe(4);
    expect(masteryPips({ ef: 2.5, interval: 90, reps: 6, lapses: 0, dueAt: 0 })).toBe(5);
  });
});
