// Study session — spec: plans/07-PRD.md §2.3 (F-21..F-23), §3.1 screen 4
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewMode, Settings, Word } from "../../types";
import { buildQueue, listWords, recordReview, type QueueEntry, type ReviewOutcome } from "../../db/repo";
import { autoGrade, GRADE, looseEqual, pickDistractors } from "../../core/grades";
import { buildSession, sessionUnits, type SessionCard, type SessionUnit } from "../../study/session";
import { t } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { Button, Card, EmptyState, IconButton, Input, Progress } from "../components";
import { navigate } from "../../App";
import { speak } from "../../platform/speech";

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Phase =
  | { k: "loading" }
  | { k: "empty" }
  | { k: "active"; units: SessionUnit[]; pool: Word[] }
  | { k: "done"; reviewed: number; correct: number; xp: number };

type AnswerFn = (word: Word, mode: ReviewMode, grade: number, ms: number) => Promise<void>;

const GRADE_LABELS = [
  { grade: GRADE.again, key: "study.again" },
  { grade: GRADE.hard, key: "study.hard" },
  { grade: GRADE.good, key: "study.good" },
  { grade: GRADE.easy, key: "study.easy" },
] as const;

const MODE_KEY: Record<ReviewMode, StringKey> = {
  flashcard: "study.mode.flashcard",
  choice: "study.mode.choice",
  typing: "study.mode.typing",
  listening: "study.mode.listening",
  matching: "study.mode.matching",
};

export default function Study({ settings }: { settings: Settings }) {
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [unitIndex, setUnitIndex] = useState(0);
  const [toastXp, setToastXp] = useState(0);
  const [hitGoal, setHitGoal] = useState(false);
  const stats = useRef({ reviewed: 0, correct: 0, xp: 0 });
  const toastTimer = useRef(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const queue: QueueEntry[] = await buildQueue(settings);
      if (!alive) return;
      if (!queue.length) {
        setPhase({ k: "empty" });
        return;
      }
      const session = buildSession(queue, settings.preferredModes);
      const pool = await listWords({ limit: 1000 });
      if (!alive) return;
      setPhase({ k: "active", units: sessionUnits(session), pool });
    })();
    return () => {
      alive = false;
      window.clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = phase.k === "active" ? phase.units : [];
  const pool = phase.k === "active" ? phase.pool : [];
  const unit = units[unitIndex];
  const totalCards = useMemo(
    () => units.reduce((n, u) => n + (u.kind === "single" ? 1 : u.batch.length), 0),
    [units]
  );
  const doneCards = useMemo(
    () => units.slice(0, unitIndex).reduce((n, u) => n + (u.kind === "single" ? 1 : u.batch.length), 0),
    [units, unitIndex]
  );

  const commit: AnswerFn = useCallback(
    async (word, mode, grade, ms) => {
      const outcome: ReviewOutcome = await recordReview(word, mode, grade, ms, settings);
      stats.current.reviewed += 1;
      if (grade >= 3) stats.current.correct += 1;
      stats.current.xp += outcome.xpGained;
      setToastXp(outcome.xpGained);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToastXp(0), 1600);
      if (outcome.hitGoal) setHitGoal(true);
    },
    [settings]
  );

  const advance = useCallback(() => {
    setHitGoal(false);
    setUnitIndex((i) => {
      if (i + 1 >= units.length) {
        setPhase({ k: "done", ...stats.current });
        return i;
      }
      return i + 1;
    });
  }, [units.length]);

  if (phase.k === "loading") {
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 py-10 text-center text-sm text-ink-soft dark:text-[#b7a895]">
        {t("common.loading")}
      </div>
    );
  }

  if (phase.k === "empty") {
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
        <header className="flex items-center gap-2 py-4">
          <IconButton aria-label={t("nav.home")} onClick={() => navigate("")}>
            ‹
          </IconButton>
          <h1 className="text-lg font-extrabold">{t("study.start")}</h1>
        </header>
        <EmptyState
          title={t("study.empty.title")}
          body={t("study.empty.body")}
          action={
            <Button className="mt-2" onClick={() => navigate("add")}>
              ＋ {t("library.newWord")}
            </Button>
          }
        />
      </div>
    );
  }

  if (phase.k === "done") {
    const accuracy = phase.reviewed ? Math.round((phase.correct / phase.reviewed) * 100) : 0;
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-extrabold">{t("study.sessionDone")}</h1>
          <Card className="mt-2 w-full max-w-xs space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft dark:text-[#b7a895]">{t("study.reviewed", { n: phase.reviewed })}</span>
              <span className="font-bold">{phase.reviewed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft dark:text-[#b7a895]">{t("study.accuracy")}</span>
              <span className="font-bold">{accuracy}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft dark:text-[#b7a895]">XP</span>
              <span className="font-bold text-accent">{t("study.xpGained", { n: phase.xp })}</span>
            </div>
          </Card>
          <Button className="mt-4 w-full max-w-xs" onClick={() => navigate("")}>
            {t("nav.home")}
          </Button>
        </div>
      </div>
    );
  }

  if (!unit) return null;

  const modeLabel = unit.kind === "single" ? t(MODE_KEY[unit.card.mode]) : t("study.mode.matching");

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-32">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.home")} onClick={() => navigate("")}>
          ✕
        </IconButton>
        <div className="flex-1">
          <Progress value={totalCards ? doneCards / totalCards : 0} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-ink-soft dark:text-[#b7a895]">
          {t("study.sessionProgress", { done: doneCards, total: totalCards })}
        </span>
      </header>

      {hitGoal && (
        <div role="status" className="mb-3 rounded-2xl bg-accent px-4 py-3 text-center text-sm font-bold text-white">
          🎯 {t("study.dailyGoalDone")}
        </div>
      )}

      <div className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft dark:text-[#b7a895]">
        {modeLabel}
      </div>

      {unit.kind === "single" ? (
        <SingleCard key={unitIndex} unit={unit} pool={pool} onAnswered={commit} onNext={advance} settings={settings} />
      ) : (
        <MatchingBoard key={unitIndex} batch={unit.batch} onPair={commit} onNext={advance} />
      )}

      {toastXp > 0 && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream shadow-lg dark:bg-[#241c14]"
        >
          ⚡ +{toastXp} XP
        </div>
      )}
    </div>
  );
}

// ---------- single-card modes ----------

function SingleCard({
  unit,
  pool,
  settings,
  onAnswered,
  onNext,
}: {
  unit: Extract<SessionUnit, { kind: "single" }>;
  pool: Word[];
  settings: Settings;
  onAnswered: AnswerFn;
  onNext: () => void;
}) {
  const { card } = unit;
  const mode = card.mode;
  const word = card.entry.word;
  const start = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);

  useEffect(() => {
    start.current = performance.now();
    if (mode === "listening") {
      speak(word.word, { lang: word.language, rate: settings.voiceRate, voiceByLang: settings.voiceByLang });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    if (mode !== "choice") return [];
    const sameLang = pool.filter((w) => w.language && w.language === word.language && w.id !== word.id);
    const fallback = pool.filter((w) => w.id !== word.id);
    const source = sameLang.length >= 3 ? sameLang : fallback;
    return shuffle([word, ...pickDistractors(source, word, 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const finish = async (grade: number) => {
    if (feedback) return;
    setFeedback({ correct: grade >= 3 });
    await onAnswered(word, mode, grade, performance.now() - start.current);
  };

  const doSpeak = () =>
    speak(word.word, { lang: word.language, rate: settings.voiceRate, voiceByLang: settings.voiceByLang });

  // ---------- flashcard (self-graded) ----------
  if (mode === "flashcard") {
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        {card.entry.isNew && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
            {t("study.new")}
          </span>
        )}
        <button className="text-3xl font-extrabold" aria-label="speak" onClick={doSpeak}>
          {word.word} 🔊
        </button>
        {revealed ? (
          <>
            {word.transcription && (
              <div className="text-sm italic text-ink-soft dark:text-[#b7a895]">[{word.transcription}]</div>
            )}
            <div className="text-xl text-ink-soft dark:text-[#b7a895]">{word.translation}</div>
            {!feedback ? (
              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                {GRADE_LABELS.map(({ grade, key }) => (
                  <Button
                    key={key}
                    variant={grade === GRADE.good ? "primary" : "outline"}
                    onClick={() => void finish(grade)}
                    aria-label={t(key)}
                  >
                    {t(key)}
                  </Button>
                ))}
              </div>
            ) : (
              <NextButton onNext={onNext} />
            )}
          </>
        ) : (
          <Button variant="dark" className="w-full" onClick={() => setRevealed(true)}>
            {t("study.showAnswer")}
          </Button>
        )}
      </Card>
    );
  }

  // ---------- multiple choice (auto-graded) ----------
  if (mode === "choice") {
    return (
      <Card className="flex min-h-64 flex-col gap-4 text-center">
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-3xl font-extrabold">{word.word}</span>
          <IconButton aria-label="speak" onClick={doSpeak}>
            🔊
          </IconButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt) => {
            const isAnswer = opt.id === word.id;
            const highlight = feedback && isAnswer ? "!border-accent" : "";
            return (
              <Button
                key={opt.id}
                variant="outline"
                className={highlight}
                disabled={!!feedback}
                onClick={() => {
                  void finish(autoGrade(isAnswer, performance.now() - start.current));
                }}
                aria-label={opt.translation}
              >
                {opt.translation}
              </Button>
            );
          })}
        </div>
        {feedback && <NextButton onNext={onNext} answer={word.translation} />}
      </Card>
    );
  }

  // ---------- typing / listening (auto-graded) ----------
  const isListening = mode === "listening";
  const expected = isListening ? word.word : word.translation;

  return (
    <Card className="flex min-h-64 flex-col gap-4 text-center">
      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="text-3xl font-extrabold">{isListening ? "🎧" : word.word}</span>
        <IconButton aria-label="speak" onClick={doSpeak}>
          {isListening ? "↻" : "🔊"}
        </IconButton>
      </div>
      {isListening && <div className="text-sm text-ink-soft dark:text-[#b7a895]">{t("study.listen")}</div>}
      {!feedback ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!answer.trim()) return;
            void finish(autoGrade(looseEqual(answer, expected), performance.now() - start.current));
          }}
        >
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t(isListening ? "study.typeHeard" : "study.typeAnswer")}
            aria-label={t(isListening ? "study.typeHeard" : "study.typeAnswer")}
            autoFocus
          />
          <Button type="submit" disabled={!answer.trim()}>
            {t("study.check")}
          </Button>
        </form>
      ) : (
        <>
          <div className={`text-lg font-bold ${feedback.correct ? "text-accent" : "text-ink dark:text-cream"}`}>
            {feedback.correct ? `✓ ${t("study.correct")}` : `✗ ${t("study.wrong")}`}
          </div>
          <NextButton onNext={onNext} answer={expected} />
        </>
      )}
    </Card>
  );
}

function NextButton({ onNext, answer }: { onNext: () => void; answer?: string }) {
  return (
    <>
      {answer && (
        <div className="text-sm text-ink-soft dark:text-[#b7a895]">
          {t("study.answerWas")}: <span className="font-bold text-ink dark:text-cream">{answer}</span>
        </div>
      )}
      <Button variant="dark" className="w-full" onClick={onNext} autoFocus>
        {t("study.next")} →
      </Button>
    </>
  );
}

// ---------- matching board (batch, per-pair auto-graded) ----------

interface MatchPair {
  card: SessionCard;
  id: number;
}

function pairsOf(batch: SessionCard[]): MatchPair[] {
  const out: MatchPair[] = [];
  for (const card of batch) {
    const id = card.entry.word.id;
    if (id !== undefined) out.push({ card, id });
  }
  return out;
}

function MatchingBoard({
  batch,
  onPair,
  onNext,
}: {
  batch: SessionCard[];
  onPair: AnswerFn;
  onNext: () => void;
}) {
  const start = useRef(0);
  const [matched, setMatched] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [mismatch, setMismatch] = useState<number | null>(null);
  const mistakes = useRef(new Map<number, number>());
  const pairs = useMemo(() => pairsOf(batch), [batch]);

  useEffect(() => {
    start.current = performance.now();
  }, []);

  const right = useMemo(
    () => shuffle(pairs.map((p) => ({ id: p.id, translation: p.card.entry.word.translation }))),
    [pairs]
  );

  const tapTranslation = async (id: number) => {
    if (selected === null || matched.has(id)) return;
    const pair = pairs.find((p) => p.id === id);
    if (!pair) return;
    if (id === selected) {
      setMatched(new Set(matched).add(id));
      setSelected(null);
      const wrongTries = mistakes.current.get(id) ?? 0;
      const ms = performance.now() - start.current;
      await onPair(pair.card.entry.word, "matching", wrongTries > 0 ? GRADE.again : autoGrade(true, ms), ms);
    } else {
      mistakes.current.set(selected, (mistakes.current.get(selected) ?? 0) + 1);
      setMismatch(id);
      setSelected(null);
      window.setTimeout(() => setMismatch(null), 450);
    }
  };

  const allMatched = pairs.length > 0 && matched.size === pairs.length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="text-center text-sm font-semibold text-ink-soft dark:text-[#b7a895]">{t("study.match.pairs")}</div>
      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex flex-col gap-2">
          {pairs.map((p) => {
            const done = matched.has(p.id);
            return (
              <button
                key={p.id}
                disabled={done}
                onClick={() => setSelected(p.id)}
                aria-label={p.card.entry.word.word}
                className={`rounded-xl px-3 py-3 text-sm font-bold ring-1 transition ${
                  done
                    ? "bg-accent-soft/40 text-ink-soft line-through ring-transparent dark:bg-[#332a20] dark:text-[#b7a895]"
                    : selected === p.id
                      ? "bg-ink text-cream ring-ink dark:bg-cream dark:text-ink"
                      : "bg-cream-2 ring-line dark:bg-[#332a20] dark:ring-[#3d3226]"
                }`}
              >
                {p.card.entry.word.word}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((r) => {
            const done = matched.has(r.id);
            return (
              <button
                key={r.id}
                disabled={done}
                onClick={() => void tapTranslation(r.id)}
                aria-label={r.translation}
                className={`rounded-xl px-3 py-3 text-sm ring-1 transition ${
                  done
                    ? "bg-accent-soft/40 text-ink-soft line-through ring-transparent dark:bg-[#332a20] dark:text-[#b7a895]"
                    : mismatch === r.id
                      ? "bg-accent/20 ring-accent"
                      : "bg-cream-2 ring-line dark:bg-[#332a20] dark:ring-[#3d3226]"
                }`}
              >
                {r.translation}
              </button>
            );
          })}
        </div>
      </div>
      {allMatched && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="text-sm font-bold text-accent">✓ {t("study.match.done")}</div>
          <Button className="w-full" onClick={onNext} autoFocus>
            {t("study.next")} →
          </Button>
        </div>
      )}
    </Card>
  );
}
