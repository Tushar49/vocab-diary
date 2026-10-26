import Dexie, { type Table } from "dexie";
import type { DailyStat, ReviewRecord, Word } from "../types";

export interface KvRow {
  key: string;
  value: unknown;
}

export interface SearchRow {
  token: string;
  wordId: number;
  field: 0 | 1 | 2; // 0=word, 1=translation/other, 2=tag
}

export class VocabDb extends Dexie {
  words!: Table<Word, number>;
  reviews!: Table<ReviewRecord, number>;
  daily!: Table<DailyStat, string>;
  kv!: Table<KvRow, string>;
  searchIndex!: Table<SearchRow, [string, number]>;

  constructor() {
    super("vocabulary-diary");
    this.version(1).stores({
      words: "++id, word, translation, *tags, language, mastery, sm2.dueAt, updatedAt, createdAt",
      reviews: "++id, wordId, at, mode",
      daily: "date",
      kv: "key",
      searchIndex: "[token+wordId], token, wordId",
    });
  }
}

export const db = new VocabDb();
