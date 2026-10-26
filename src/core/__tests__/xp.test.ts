import { describe, expect, it } from "vitest";
import { xpForLevel, levelFor, levelProgress } from "../xp";

describe("xp curve", () => {
  it("thresholds match 150*(n-1)^2", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(150);
    expect(xpForLevel(3)).toBe(600);
    expect(xpForLevel(4)).toBe(1350);
    expect(xpForLevel(5)).toBe(2400);
  });

  it("levelFor maps xp to level", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(149)).toBe(1);
    expect(levelFor(150)).toBe(2);
    expect(levelFor(599)).toBe(2);
    expect(levelFor(1350)).toBe(4);
  });

  it("levelProgress spans the current level", () => {
    const p = levelProgress(300);
    expect(p.level).toBe(2);
    expect(p.into).toBe(150);
    expect(p.span).toBe(450);
    expect(p.total).toBe(300);
  });
});
