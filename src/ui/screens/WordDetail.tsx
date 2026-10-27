// Word detail — spec: plans/07-PRD.md §2.2 (F-14), §3.1 screen 2
import { useEffect, useState } from "react";
import type { Settings, Word } from "../../types";
import { deleteWord, getWord } from "../../db/repo";
import { masteryPips } from "../../core/sm2";
import { t } from "../../i18n";
import { Button, Card, Chip, EmptyState, IconButton } from "../components";
import { navigate } from "../../App";
import { speak } from "../../platform/speech";

const MASTERY_KEY = {
  new: "mastery.new",
  learning: "mastery.learning",
  review: "mastery.review",
  mastered: "mastery.mastered",
  lapsed: "mastery.lapsed",
} as const;

function Pips({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${t("detail.mastery")} ${value}/5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${i < value ? "bg-accent" : "bg-line dark:bg-[#3d3226]"}`}
        />
      ))}
    </span>
  );
}

export default function WordDetail({ settings, id }: { settings: Settings; id: number }) {
  const [word, setWord] = useState<Word | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void getWord(id).then((w) => {
      setWord(w ?? null);
      setLoaded(true);
    });
  }, [id]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  const share = async () => {
    if (!word) return;
    const text = `${word.word} — ${word.translation}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: word.word, text });
      } else {
        await navigator.clipboard.writeText(text);
        flash(t("detail.copied"));
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  const remove = async () => {
    if (!word?.id) return;
    await deleteWord(word.id);
    navigate("");
  };

  if (!loaded) {
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 py-10 text-center text-sm text-ink-soft dark:text-[#b7a895]">
        {t("common.loading")}
      </div>
    );
  }

  if (!word) {
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
        <EmptyState
          title={t("library.empty.title")}
          body={t("library.empty.body")}
          action={
            <Button className="mt-2" onClick={() => navigate("")}>
              {t("nav.home")}
            </Button>
          }
        />
      </div>
    );
  }

  const due = word.sm2.dueAt > 0 ? new Date(word.sm2.dueAt).toLocaleDateString() : "";

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.back")} onClick={() => navigate("")}>
          ‹
        </IconButton>
        <h1 className="sr-only">{word.word}</h1>
        <div className="ml-auto flex gap-2">
          <IconButton aria-label={t("word.share")} onClick={() => void share()}>
            🔗
          </IconButton>
          <IconButton aria-label={t("word.edit")} onClick={() => navigate(`add/${word.id}`)}>
            ✏️
          </IconButton>
        </div>
      </header>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xl font-extrabold">{word.word}</div>
            {word.transcription && (
              <div className="text-sm italic text-ink-soft dark:text-[#b7a895]">[{word.transcription}]</div>
            )}
            <div className="mt-1 text-base text-ink-soft dark:text-[#b7a895]">{word.translation}</div>
          </div>
          <IconButton
            aria-label="speak"
            onClick={() => speak(word.word, { lang: word.language, rate: settings.voiceRate, voiceByLang: settings.voiceByLang })}
          >
            🔊
          </IconButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft dark:text-[#b7a895]">
          <Pips value={masteryPips(word.sm2)} />
          <span className="rounded-full bg-cream-2 px-2 py-0.5 font-medium dark:bg-[#332a20]">
            {t(MASTERY_KEY[word.mastery])}
          </span>
          {due && <span>⏱ {due}</span>}
          {word.language && <span>🌐 {word.language}</span>}
        </div>
      </Card>

      {word.tags.length > 0 && (
        <Card className="mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
            {t("word.tags")}
          </div>
          <div className="flex flex-wrap gap-1">
            {word.tags.map((tg) => (
              <Chip key={tg} label={tg} />
            ))}
          </div>
        </Card>
      )}

      {word.note && (
        <Card className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
            {t("word.note")}
          </div>
          <p className="whitespace-pre-wrap text-sm">{word.note}</p>
        </Card>
      )}

      {word.examples.length > 0 && (
        <Card className="mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
            {t("word.examples")}
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {word.examples.map((ex, i) => (
              <li key={`${i}-${ex}`}>{ex}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`translate?text=${encodeURIComponent(word.word)}`)}
        >
          🌐 {t("translate.title")}
        </Button>
        {confirmDelete ? (
          <Button variant="dark" className="flex-1" onClick={() => void remove()} aria-label={t("word.delete")}>
            {t("word.delete")}
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(true)} aria-label={t("word.delete")}>
            🗑 {t("word.delete")}
          </Button>
        )}
      </div>
      {confirmDelete && (
        <button className="mt-2 w-full text-xs text-ink-soft underline dark:text-[#b7a895]" onClick={() => setConfirmDelete(false)}>
          {t("common.close")}
        </button>
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-lg dark:bg-[#241c14]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
