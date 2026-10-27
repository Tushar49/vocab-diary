import { describe, expect, it } from "vitest";
import { allowedModes, buildSession, MATCH_BATCH_SIZE, pickMode, sessionUnits } from "./session";
import { newSm2, type Mastery, type Word } from "../types";
import type { QueueEntry } from "../db/repo";

function makeWord(mastery: Mastery, id: number): Word {
  return {
    id,
    word: `w${id}`,
    translation: `t${id}`,
    examples: [],
    tags: [],
    createdAt: id,
    updatedAt: id,
    sm2: newSm2(),
    mastery,
  };
}

function entry(mastery: Mastery, id: number): QueueEntry {
  return { word: makeWord(mastery, id), isNew: mastery === "new" };
}

const ALL_MODES = ["flashcard", "choice", "typing", "listening", "matching"] as const;

describe("allowedModes", () => {
  it("gates modes by mastery tier (PRD §6.3)", () => {
    expect(allowedModes("new")).toEqual(["flashcard", "choice"]);
    expect(allowedModes("learning")).toEqual(["flashcard", "choice"]);
    expect(allowedModes("review")).toEqual(["flashcard", "choice", "typing", "listening"]);
    expect(allowedModes("mastered")).toEqual([...ALL_MODES]);
  });
});

describe("pickMode", () => {
  it("rotates deterministically through the allowed pool", () => {
    expect(pickMode("mastered", 0)).toBe("flashcard");
    expect(pickMode("mastered", 4)).toBe("matching");
    expect(pickMode("mastered", 5)).toBe("flashcard");
  });

  it("honours preferred modes as a subset filter", () => {
    expect(pickMode("mastered", 0, ["typing", "listening"])).toBe("typing");
    expect(pickMode("mastered", 1, ["typing", "listening"])).toBe("listening");
    expect(pickMode("mastered", 2, ["typing", "listening"])).toBe("typing");
  });

  it("falls back to flashcard when preferences and tier don't intersect", () => {
    expect(pickMode("learning", 0, ["typing"])).toBe("flashcard");
  });

  it("treats empty preferences as no restriction", () => {
    expect(pickMode("mastered", 0, [])).toBe("flashcard");
    expect(pickMode("mastered", 3, [])).toBe("listening");
  });

  it("never offers a gated mode to a low tier", () => {
    for (let i = 0; i < 12; i++) {
      expect(ALL_MODES).toContainEqual(pickMode("learning", i, [...ALL_MODES]));
      expect(["flashcard", "choice"]).toContainEqual(pickMode("learning", i, [...ALL_MODES]));
    }
  });
});

describe("buildSession", () => {
  it("returns an empty session for an empty queue", () => {
    expect(buildSession([], ["flashcard"])).toEqual([]);
    expect(sessionUnits(buildSession([], ["flashcard"]))).toEqual([]);
  });

  it("preserves the queue's order (new first, then due)", () => {
    const queue = [entry("new", 1), entry("new", 2), entry("review", 3), entry("mastered", 4)];
    const cards = buildSession(queue, [...ALL_MODES]);
    expect(cards.map((c) => c.entry.word.id)).toEqual([1, 2, 3, 4]);
  });

  it("respects preferred modes for every card", () => {
    const queue = [entry("new", 1), entry("review", 2), entry("mastered", 3)];
    const cards = buildSession(queue, ["flashcard"]);
    expect(cards.map((c) => c.mode)).toEqual(["flashcard", "flashcard", "flashcard"]);
  });

  it("falls back to flashcard when tier and preferences don't intersect", () => {
    const queue = [entry("learning", 1)];
    const cards = buildSession(queue, ["typing", "listening"]);
    expect(cards[0].mode).toBe("flashcard");
  });

  it("rotates modes across a mixed-tier session", () => {
    const queue = [entry("mastered", 1), entry("mastered", 2), entry("mastered", 3)];
    const cards = buildSession(queue, [...ALL_MODES]);
    expect(cards.map((c) => c.mode)).toEqual(["flashcard", "choice", "typing"]);
  });

  it("downgrades a lone matching card to choice", () => {
    const cards = buildSession([entry("mastered", 1)], ["matching"]);
    expect(cards).toHaveLength(1);
    expect(cards[0].mode).toBe("choice");
  });
});

describe("matching batches", () => {
  it("caps consecutive matching runs at MATCH_BATCH_SIZE", () => {
    const queue = Array.from({ length: 7 }, (_, i) => entry("mastered", i + 1));
    const cards = buildSession(queue, ["matching"]);
    expect(cards).toHaveLength(7);
    const units = sessionUnits(cards);
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ kind: "match" });
    expect(units[1]).toMatchObject({ kind: "match" });
    expect(units[0].kind === "match" && units[0].batch).toHaveLength(MATCH_BATCH_SIZE);
    expect(units[1].kind === "match" && units[1].batch).toHaveLength(2);
  });

  it("keeps singles as single units around matching runs", () => {
    // review/new tiers can't match with preferred ["matching"] → flashcard fallback;
    // the two consecutive mastered cards form a 2-pair board.
    const queue = [entry("review", 1), entry("mastered", 2), entry("mastered", 3), entry("new", 4)];
    const units = sessionUnits(buildSession(queue, ["matching"]));
    expect(units.map((u) => u.kind)).toEqual(["single", "match", "single"]);
    expect(units[0].kind === "single" && units[0].card.entry.word.id).toBe(1);
    expect(units[2].kind === "single" && units[2].card.entry.word.id).toBe(4);
  });

  it("splits a long matching run into capped batches with correct order", () => {
    const queue = Array.from({ length: 12 }, (_, i) => entry("mastered", i + 1));
    const units = sessionUnits(buildSession(queue, ["matching"]));
    expect(units.map((u) => (u.kind === "match" ? u.batch.length : 1))).toEqual([5, 5, 2]);
    const ids = units.flatMap((u) => (u.kind === "match" ? u.batch.map((c) => c.entry.word.id) : []));
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
