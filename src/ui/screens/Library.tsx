import { useEffect, useMemo, useState } from "react";
import type { Settings, Word } from "../../types";
import { allLanguages, allTags, countWords, deleteWord, listWords, updateWord, type SortKey } from "../../db/repo";
import { t } from "../../i18n";
import { Button, Card, Chip, EmptyState, IconButton, Input, Sheet } from "../components";
import { navigate } from "../../App";
import { speak } from "../../platform/speech";

function greetingKey(): "greeting.morning" | "greeting.afternoon" | "greeting.evening" {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

type BulkAction = "addTag" | "setLanguage" | "delete";

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

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [bulkInput, setBulkInput] = useState("");

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

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
    setBulk(null);
    setBulkInput("");
  };

  const runBulk = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (bulk === "delete") {
      for (const id of ids) await deleteWord(id);
    } else if (bulk === "addTag") {
      const tag = bulkInput.trim();
      if (tag) {
        for (const id of ids) {
          const w = words.find((x) => x.id === id);
          if (w) await updateWord(id, { tags: [...new Set([...w.tags, tag])] });
        }
      }
    } else if (bulk === "setLanguage") {
      const lang = bulkInput.trim();
      for (const id of ids) await updateWord(id, { language: lang });
    }
    exitSelect();
    await reload();
  };

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
            <Chip
              label={language || t("library.allLanguages")}
              active={!!language}
              onClick={() => setLanguage(language ? "" : (languages[0] ?? ""))}
            />
          )}
          {tags.map((tg) => (
            <Chip key={tg.name} label={tg.name} active={activeTags.includes(tg.name)} onClick={() => toggleTag(tg.name)} />
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-ink-soft dark:text-[#b7a895]">
        <span>{t("library.count", { n: total })}</span>
        <div className="flex gap-1">
          {words.length > 0 && (
            <button
              className={`rounded-full px-2 py-1 ${selecting ? "bg-accent text-white" : ""}`}
              onClick={() => (selecting ? exitSelect() : setSelecting(true))}
            >
              {selecting ? t("library.bulk.done") : t("library.select")}
            </button>
          )}
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
              <Card className={selecting && selected.has(w.id!) ? "ring-2 ring-accent" : ""}>
                <div className="flex items-start gap-2">
                  {selecting && (
                    <input
                      type="checkbox"
                      className="mt-1.5 h-5 w-5 accent-[#c4552d]"
                      checked={selected.has(w.id!)}
                      onChange={() => toggleSelect(w.id!)}
                      aria-label={w.word}
                    />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    className="min-w-0 flex-1"
                    onClick={() => (selecting ? toggleSelect(w.id!) : navigate(`word/${w.id}`))}
                    onKeyDown={(e) => e.key === "Enter" && !selecting && navigate(`word/${w.id}`)}
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
                    {w.transcription && (
                      <div className="text-xs italic text-ink-soft/70 dark:text-[#8f8272]">[{w.transcription}]</div>
                    )}
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
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {words.length >= limit && !selecting && (
        <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + 60)}>
          {t("library.showMore")}
        </Button>
      )}

      {selecting ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-5">
          <div className="flex items-center gap-2 rounded-full bg-ink/95 p-2 pl-4 text-cream shadow-lg dark:bg-[#241c14]/95">
            <span className="text-sm font-semibold">{t("library.selected", { n: selected.size })}</span>
            <div className="ml-auto flex gap-1">
              <IconButton aria-label={t("library.bulk.addTag")} onClick={() => setBulk("addTag")}>
                🏷️
              </IconButton>
              <IconButton aria-label={t("library.bulk.setLanguage")} onClick={() => setBulk("setLanguage")}>
                🗂️
              </IconButton>
              <IconButton aria-label={t("library.bulk.delete")} onClick={() => setBulk("delete")}>
                🗑️
              </IconButton>
            </div>
          </div>
        </div>
      ) : (
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
              <IconButton
                aria-label={t("library.search")}
                onClick={() => document.querySelector<HTMLInputElement>('input[aria-label="Search"]')?.focus()}
              >
                🔍
              </IconButton>
            </div>
          </div>
        </div>
      )}

      {bulk && (
        <Sheet
          title={
            bulk === "addTag"
              ? t("library.bulk.addTag")
              : bulk === "setLanguage"
                ? t("library.bulk.setLanguage")
                : t("library.bulk.delete")
          }
          onClose={() => setBulk(null)}
        >
          {bulk === "delete" ? (
            <div className="space-y-3">
              <p className="text-sm">{t("library.bulk.deleteConfirm", { n: selected.size })}</p>
              <Button
                className="w-full"
                onClick={() => {
                  void runBulk();
                }}
              >
                {t("word.delete")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bulk === "setLanguage" && languages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {languages.map((l) => (
                    <Chip key={l} label={l} onClick={() => setBulkInput(l)} />
                  ))}
                </div>
              )}
              <Input
                autoFocus
                placeholder={bulk === "addTag" ? t("word.addTag") : t("word.language")}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
              <Button className="w-full" disabled={!bulkInput.trim()} onClick={() => void runBulk()}>
                {t("common.ok")}
              </Button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
