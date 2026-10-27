/** Study session assembly: adaptive per-card mode selection + matching batches.
 *
 *  Mode offered depends on the mastery tier (PRD §6.3):
 *    new / learning → flashcard, multiple choice
 *    review         → + typing, listening
 *    mastered       → all five (incl. matching)
 *  The user's preferred modes narrow the pool; if the intersection is empty
 *  the card falls back to a plain flashcard so the session never stalls.
 *  Selection is a deterministic rotation over the allowed pool — varied,
 *  testable, and free of hidden randomness.
 */
import type { Mastery, ReviewMode } from "../types";
import type { QueueEntry } from "../db/repo";

export interface SessionCard {
  entry: QueueEntry;
  mode: ReviewMode;
}

export type SessionUnit =
  | { kind: "single"; card: SessionCard }
  | { kind: "match"; batch: SessionCard[] };

/** Max word–translation pairs in one matching board. */
export const MATCH_BATCH_SIZE = 5;

export function allowedModes(mastery: Mastery): ReviewMode[] {
  switch (mastery) {
    case "new":
    case "learning":
    case "lapsed":
      return ["flashcard", "choice"];
    case "review":
      return ["flashcard", "choice", "typing", "listening"];
    case "mastered":
      return ["flashcard", "choice", "typing", "listening", "matching"];
  }
}

/** Deterministic rotation: card `index` in the session picks pool[index % len]. */
export function pickMode(mastery: Mastery, index: number, preferred: readonly ReviewMode[] = []): ReviewMode {
  const allowed = allowedModes(mastery);
  const usable = preferred.length ? allowed.filter((m) => preferred.includes(m)) : allowed;
  const pool = usable.length ? usable : (["flashcard"] as ReviewMode[]);
  return pool[index % pool.length];
}

/**
 * Build the per-card session from the scheduler queue, preserving the
 * queue's order (new words first, then due — see buildQueue). Consecutive
 * matching cards are capped at MATCH_BATCH_SIZE; a lone matching card is
 * downgraded to multiple choice, since a 1-pair board is not a game.
 */
export function buildSession(queue: readonly QueueEntry[], preferred?: readonly ReviewMode[]): SessionCard[] {
  const cards: SessionCard[] = queue.map((entry, i) => ({ entry, mode: pickMode(entry.word.mastery, i, preferred) }));

  const out: SessionCard[] = [];
  let i = 0;
  while (i < cards.length) {
    if (cards[i].mode !== "matching") {
      out.push(cards[i++]);
      continue;
    }
    let j = i;
    while (j < cards.length && cards[j].mode === "matching" && j - i < MATCH_BATCH_SIZE) j++;
    const run = cards.slice(i, j);
    if (run.length === 1) out.push({ ...run[0], mode: "choice" });
    else out.push(...run);
    i = j;
  }
  return out;
}

/** Group consecutive matching cards into playable batch units for the UI (capped). */
export function sessionUnits(cards: readonly SessionCard[]): SessionUnit[] {
  const units: SessionUnit[] = [];
  let i = 0;
  while (i < cards.length) {
    if (cards[i].mode !== "matching") {
      units.push({ kind: "single", card: cards[i++] });
      continue;
    }
    let j = i;
    while (j < cards.length && cards[j].mode === "matching" && j - i < MATCH_BATCH_SIZE) j++;
    units.push({ kind: "match", batch: cards.slice(i, j) });
    i = j;
  }
  return units;
}

/** SM-2 correctness threshold: grades 3+ count as correct. */
export function isCorrectGrade(grade: number): boolean {
  return grade >= 3;
}
