// Progress — spec: plans/07-PRD.md §2.3 (F-25), §3.1 screen 5
import { useEffect, useMemo, useState } from "react";
import type { DailyStat, Mastery, Settings } from "../../types";
import { levelProgress } from "../../core/xp";
import { masteryPips } from "../../core/sm2";
import { dateKeyOf } from "../../core/date";
import { listWords, monthCalendar, streakInfo, totalXp, wordHistory, type HistoryRow } from "../../db/repo";
import { t } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { Button, Card, Chip, EmptyState, IconButton, Progress } from "../components";
import { navigate } from "../../App";

const WEEKDAYS: StringKey[] = ["progress.mon", "progress.tue", "progress.wed", "progress.thu", "progress.fri", "progress.sat", "progress.sun"];
type Filter = "all" | "learning" | "mastered";

function relDate(ts: number | null): string {
  if (!ts) return "";
  const day = 86_400_000;
  const startOf = (v: number) => new Date(v).setHours(0, 0, 0, 0);
  const diff = Math.round((startOf(Date.now()) - startOf(ts)) / day);
  if (diff <= 0) return t("progress.today");
  if (diff === 1) return t("progress.yesterday");
  if (diff < 7) return t("progress.daysAgo", { n: diff });
  if (diff < 30) return t("progress.weeksAgo", { n: Math.floor(diff / 7) });
  if (diff < 365) return t("progress.monthsAgo", { n: Math.floor(diff / 30) });
  return t("progress.yearsAgo", { n: Math.floor(diff / 365) });
}

function Pips({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" role="img" aria-label={`${t("detail.mastery")} ${value}/5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i < value ? "bg-accent" : "bg-line dark:bg-[#3d3226]"}`} />
      ))}
    </span>
  );
}

export default function ProgressScreen({ settings }: { settings: Settings }) {
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [level, setLevel] = useState({ level: 1, into: 0, span: 1, total: 0 });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, learning: 0, mastered: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calStats, setCalStats] = useState<DailyStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [s, xp, rows, words] = await Promise.all([
        streakInfo(settings.dayStartHour),
        totalXp(),
        wordHistory(200),
        listWords({ limit: 100000 }),
      ]);
      setStreak(s);
      setLevel(levelProgress(xp));
      setHistory(rows);
      setCounts({
        all: words.length,
        learning: words.filter((w) => w.mastery === "learning" || w.mastery === "review" || w.mastery === "lapsed").length,
        mastered: words.filter((w) => w.mastery === "mastered").length,
      });
      setLoaded(true);
    })();
  }, [settings.dayStartHour]);

  useEffect(() => {
    void monthCalendar(cursor.year, cursor.month).then(setCalStats);
  }, [cursor]);

  const statByDate = useMemo(() => new Map(calStats.map((d) => [d.date, d])), [calStats]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: { day: number | null; key: string }[] = [];
    for (let i = 0; i < offset; i++) list.push({ day: null, key: `pad-${i}` });
    for (let d = 1; d <= days; d++) {
      list.push({ day: d, key: `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    return list;
  }, [cursor]);

  const todayKey = dateKeyOf(new Date());
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(cursor.year, cursor.month, 1)
  );

  const moveMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const filtered = useMemo(() => {
    if (filter === "all") return history;
    const wanted: Mastery[] = filter === "learning" ? ["learning", "review", "lapsed"] : ["mastered"];
    return history.filter((h) => wanted.includes(h.word.mastery));
  }, [history, filter]);

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.back")} onClick={() => navigate("")}>
          ‹
        </IconButton>
        <h1 className="text-lg font-extrabold">{t("progress.title")}</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-3xl font-extrabold">
            🔥 {streak.current}
          </div>
          <div className="text-xs text-ink-soft dark:text-[#b7a895]">
            {t("progress.streak")} · {t("progress.best", { n: streak.best })}
          </div>
        </Card>
        <Card>
          <div className="text-3xl font-extrabold">{t("progress.level", { n: level.level })}</div>
          <div className="mb-2 text-xs text-ink-soft dark:text-[#b7a895]">
            {t("progress.toNext", { into: level.into, span: level.span, next: level.level + 1 })}
          </div>
          <Progress value={level.span ? level.into / level.span : 0} />
        </Card>
      </div>

      <Card className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold">{t("progress.wordsLearned")}</div>
          <div className="flex items-center gap-1">
            <IconButton aria-label={t("progress.prevMonth")} className="!h-8 !w-8" onClick={() => moveMonth(-1)}>
              ‹
            </IconButton>
            <span className="min-w-32 text-center text-xs font-semibold">{monthLabel}</span>
            <IconButton aria-label={t("progress.nextMonth")} className="!h-8 !w-8" onClick={() => moveMonth(1)}>
              ›
            </IconButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-ink-soft dark:text-[#b7a895]">
          {WEEKDAYS.map((k) => (
            <span key={k}>{t(k)}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((c) => {
            if (c.day === null) return <span key={c.key} />;
            const stat = statByDate.get(c.key);
            const active = !!stat && stat.learned > 0;
            const reviewed = !!stat && stat.reviews > 0;
            const isToday = c.key === todayKey;
            return (
              <div
                key={c.key}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs tabular-nums ${
                  isToday ? "ring-2 ring-accent" : ""
                } ${active ? "bg-accent-soft/60 dark:bg-accent/30" : reviewed ? "bg-cream-2 dark:bg-[#332a20]" : ""}`}
              >
                {c.day}
                {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" aria-hidden />}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">{t("progress.wordHistory")}</h2>
        <div className="flex gap-1">
          {(
            [
              { key: "all", label: t("progress.all"), n: counts.all },
              { key: "learning", label: t("progress.learning"), n: counts.learning },
              { key: "mastered", label: t("progress.mastered"), n: counts.mastered },
            ] as { key: Filter; label: string; n: number }[]
          ).map((f) => (
            <Chip
              key={f.key}
              label={`${f.label} ${f.n}`}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>
      </div>

      {!loaded ? (
        <div className="py-8 text-center text-sm text-ink-soft dark:text-[#b7a895]">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("progress.empty")}
          action={
            <Button className="mt-2" onClick={() => navigate("study")}>
              📚 {t("study.start")}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((h) => (
            <li key={h.word.id}>
              <Card className="!p-3">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-3"
                  onClick={() => navigate(`word/${h.word.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`word/${h.word.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{h.word.word}</div>
                    <div className="truncate text-xs text-ink-soft dark:text-[#b7a895]">{h.word.translation}</div>
                  </div>
                  <Pips value={masteryPips(h.word.sm2)} />
                  <span className="w-20 shrink-0 text-right text-[10px] text-ink-soft dark:text-[#b7a895]">
                    {relDate(h.lastReviewAt)}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
