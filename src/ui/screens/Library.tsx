import { useEffect, useMemo, useState } from "react";
import type { Settings, Word } from "../../types";
import { allLanguages, allTags, countWords, listWords, type SortKey } from "../../db/repo";
import { t } from "../../i18n";
import { Button, Card, Chip, EmptyState, IconButton, Input } from "../components";
import { navigate } from "../../App";
import { speak } from "../../platform/speech";

function greetingKey(): "greeting.morning" | "greeting.afternoon" | "greeting.evening" {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

export default function Library({ settings, addPrefill }: { settings: Settings; addPrefill?: URLSearchParams }) {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(60);

  const reload = useMemo(
    () => async () => {
      const [ws, count, tg, langs] = await Promise.all([
        listWords({ query, tags: activeTags, language: language || undefined, sort, limit }),
        countWords(),
        allTags(),
        allLanguages(),
      ]);
      setWords(ws);
      setTotal(count);
      setTags(tg);
      setLanguages(langs);
    },
    [query, activeTags, language, sort, limit]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // prefill from deep link (#/?add=...)
  useEffect(() => {
    if (addPrefill && (addPrefill.get("word") || addPrefill.get("translation") || addPrefill.get("text"))) {
      navigate(`add?${addPrefill.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTag = (name: string) =>
    setActiveTags((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  const dueSoon = 0; // computed inside Study; keep header light

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center justify-between py-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft dark:text-[#b7a895]">
          {t("app.name")}
        </div>
        <div className="flex gap-2">
          <IconButton aria-label={t("nav.progress")} onClick={() => navigate("progress")}>
            👤
          </IconButton>
          <IconButton aria-label={t("nav.settings")} onClick={() => navigate("settings")}>
            ⚙️
          </IconButton>
        </div>
      </header>

      <h1 className="mb-3 text-2xl font-extrabold">{t(greetingKey())}</h1>

      <Button variant="dark" className="mb-3 w-full justify-between" onClick={() => navigate("study")}>
        <span>📚 {t("study.start")}</span>
        <span aria-hidden>›</span>
      </Button>

      <Input
        placeholder={t("library.search")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(60);
        }}
        aria-label={t("library.search")}
      />

      {(languages.length > 0 || activeTags.length > 0 || tags.length > 0) && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {languages.length > 1 && (
            <Chip label={language || t("library.allLanguages")} active={!!language} onClick={() => setLanguage(language ? "" : (languages[0] ?? ""))} />
          )}
          {tags.map((tg) => (
            <Chip key={tg.name} label={tg.name} active={activeTags.includes(tg.name)} onClick={() => toggleTag(tg.name)} />
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft dark:text-[#b7a895]">
        <span>{t("library.count", { n: total })}</span>
        <div className="flex gap-1">
          {(["recent", "alpha", "due"] as SortKey[]).map((k) => (
            <button
              key={k}
              className={`rounded-full px-2 py-1 ${sort === k ? "bg-ink text-cream dark:bg-cream dark:text-ink" : ""}`}
              onClick={() => setSort(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {words.length === 0 ? (
        <EmptyState
          title={query || activeTags.length ? t("library.emptyTag.title") : t("library.empty.title")}
          body={query || activeTags.length ? undefined : t("library.empty.body")}
          action={
            !query && !activeTags.length ? (
              <Button className="mt-2" onClick={() => navigate("add")}>
                ＋ {t("library.newWord")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="mt-3 space-y-2">
          {words.map((w) => (
            <li key={w.id}>
              <Card className="cursor-pointer" >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`word/${w.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`word/${w.id}`)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold">{w.word}</span>
                    <button
                      aria-label="speak"
                      className="text-ink-soft dark:text-[#b7a895]"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(w.word, { lang: w.language, rate: settings.voiceRate, voiceByLang: settings.voiceByLang });
                      }}
                    >
                      🔊
                    </button>
                  </div>
                  <div className="text-sm text-ink-soft dark:text-[#b7a895]">{w.translation}</div>
                  {w.transcription && <div className="text-xs italic text-ink-soft/70 dark:text-[#8f8272]">[{w.transcription}]</div>}
                  {w.note && <div className="mt-1 line-clamp-2 text-xs text-ink-soft dark:text-[#b7a895]">{w.note}</div>}
                  {w.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.tags.map((tg) => (
                        <span key={tg} className="rounded-full bg-cream-2 px-2 py-0.5 text-[10px] font-medium dark:bg-[#332a20]">
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {words.length >= limit && (
        <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + 60)}>
          {t("library.showMore")}
        </Button>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-5">
        <div className="flex items-center gap-3 rounded-full bg-ink/95 p-2 pl-4 text-cream shadow-lg dark:bg-[#241c14]/95">
          <button className="flex items-center gap-2 font-bold" onClick={() => navigate("add")}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-cream text-ink">＋</span>
            <span className="text-sm">{t("library.newWord").toUpperCase()}</span>
          </button>
          <div className="ml-auto flex gap-2">
            <IconButton aria-label={t("translate.title")} onClick={() => navigate("translate")}>
              🌐
            </IconButton>
            <IconButton aria-label={t("library.search")} onClick={() => document.querySelector<HTMLInputElement>('input[aria-label="Search"]')?.focus()}>
              🔍
            </IconButton>
          </div>
        </div>
      </div>
      <span className="hidden">{dueSoon}</span>
    </div>
  );
}
