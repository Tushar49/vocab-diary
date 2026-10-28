/** Core domain types shared by db, core algorithms and UI. */

export type Mastery = "new" | "learning" | "review" | "mastered" | "lapsed";

export type ReviewMode = "flashcard" | "choice" | "typing" | "listening" | "matching";

/** SM-2 state. `interval` is in days (0 = relearn in-session). */
export interface Sm2State {
  ef: number;
  interval: number;
  reps: number;
  lapses: number;
  dueAt: number; // epoch ms
}

export interface Word {
  id?: number;
  word: string;
  /** Primary meaning (display label: "Meaning"). */
  translation: string;
  /** Part of speech: noun, verb, adjective … (free text, usually from the POS chip set). */
  pos?: string;
  /** Additional meanings beyond the primary one. */
  meanings?: string[];
  /** Words linked as synonyms/related (word ids). */
  synonyms?: number[];
  transcription?: string;
  note?: string;
  examples: string[];
  tags: string[];
  language?: string;
  createdAt: number;
  updatedAt: number;
  sm2: Sm2State;
  mastery: Mastery;
}

export interface ReviewRecord {
  id?: number;
  wordId: number;
  at: number;
  mode: ReviewMode;
  grade: number; // 0..5
  correct: boolean;
  ms: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD (local, dayStart-aware)
  learned: number;
  reviews: number;
  xp: number;
}

export interface AiSettings {
  provider: "openai" | "gemini";
  baseUrl: string; // e.g. https://api.openai.com/v1
  apiKey: string;
  model: string;
  consent: boolean;
}

export interface Settings {
  newPerDay: number;
  maxReviewsPerDay: number;
  dailyGoal: number;
  dayStartHour: number;
  appearance: "system" | "light" | "dark";
  voiceRate: number;
  voiceByLang: Record<string, string>;
  preferredModes: ReviewMode[];
  ai?: AiSettings;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  maxReviewsPerDay: 100,
  dailyGoal: 20,
  dayStartHour: 4,
  appearance: "system",
  voiceRate: 1,
  voiceByLang: {},
  preferredModes: ["flashcard", "choice", "typing", "listening", "matching"],
  onboarded: false,
};

export const newSm2 = (): Sm2State => ({ ef: 2.5, interval: 0, reps: 0, lapses: 0, dueAt: 0 });

export interface ParsedWord {
  word: string;
  translation: string;
  pos?: string;
  meanings?: string[];
  synonyms?: number[];
  transcription?: string;
  note?: string;
  examples?: string[];
  tags?: string[];
  language?: string;
  /** Backup-restore fidelity (JSON round-trip only). */
  id?: number;
  sm2?: Sm2State;
  mastery?: Mastery;
  createdAt?: number;
  updatedAt?: number;
}
