// Quick add (≤2 taps) + full editor — spec: plans/07-PRD.md §2.1 (F-01..F-04), §3.1 screens 2-3
import { useEffect, useState } from "react";
import type { Settings } from "../../types";
import { createWord, deleteWord, getWord, updateWord, allLanguages } from "../../db/repo";
import { t } from "../../i18n";
import { Button, Card, Chip, Field, IconButton, Input, Textarea } from "../components";
import { navigate } from "../../App";

/** "word<TAB>translation" / "word — translation" / "word - translation" / "word: translation" */
function splitPair(text: string): { word: string; translation: string } {
  const m = text.trim().match(/^(.+?)\s*(?:\t+|\s+[-–—]\s+|\s+:\s+)\s*(.+)$/);
  if (!m) return { word: text.trim(), translation: "" };
  return { word: m[1].trim(), translation: m[2].trim() };
}

const LAST_LANG_KEY = "vd:lastLang";
const LAST_TAGS_KEY = "vd:lastTags";

function readLastLang(): string {
  try {
    return localStorage.getItem(LAST_LANG_KEY) ?? "";
  } catch {
    return "";
  }
}

function readLastTags(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LAST_TAGS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export default function AddEdit({ editId, query }: { settings: Settings; editId?: number; query: URLSearchParams }) {
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [transcription, setTranscription] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [exampleInput, setExampleInput] = useState("");
  const [language, setLanguage] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(!!editId);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const focusWord = () =>
    document.querySelector<HTMLInputElement>(`input[aria-label="${t("word.word")}"]`)?.focus();

  // Load an existing word for the editor.
  useEffect(() => {
    if (!editId) return;
    void getWord(editId).then((w) => {
      if (!w) return;
      setWord(w.word);
      setTranslation(w.translation);
      setTranscription(w.transcription ?? "");
      setNote(w.note ?? "");
      setTags(w.tags);
      setExamples(w.examples);
      setLanguage(w.language ?? "");
    });
  }, [editId]);

  // Deep-link prefill: #/add?word=X&translation=Y or ?text=…
  useEffect(() => {
    if (editId) return;
    const qw = query.get("word") ?? "";
    const qt = query.get("translation") ?? "";
    const text = query.get("text") ?? "";
    if (qw || qt) {
      setWord(qw);
      setTranslation(qt);
    } else if (text) {
      const pair = splitPair(text);
      setWord(pair.word);
      setTranslation(pair.translation);
    }
    const lastLang = readLastLang();
    const lastTags = readLastTags();
    if (lastLang) setLanguage(lastLang);
    if (lastTags.length) setTags(lastTags);
    if (!qw && !qt && !text && !lastTags.length) setExpanded(false);
    focusWord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void allLanguages().then(setLanguages);
  }, []);

  const rememberLastUsed = (lang: string, tg: string[]) => {
    try {
      if (lang) localStorage.setItem(LAST_LANG_KEY, lang);
      else localStorage.removeItem(LAST_LANG_KEY);
      localStorage.setItem(LAST_TAGS_KEY, JSON.stringify(tg));
    } catch {
      /* storage unavailable — non-fatal */
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      const pair = splitPair(text);
      if (pair.word) setWord(pair.word);
      if (pair.translation) setTranslation(pair.translation);
      focusWord();
    } catch {
      setError(t("add.clipboardFailed"));
    }
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (!tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  };

  const addExample = () => {
    const value = exampleInput.trim();
    if (!value) return;
    setExamples([...examples, value]);
    setExampleInput("");
  };

  const save = async () => {
    if (!word.trim() || !translation.trim()) {
      setError(t("word.required"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const input = {
        word,
        translation,
        transcription: transcription || undefined,
        note: note || undefined,
        examples,
        tags,
        language: language || undefined,
      };
      if (editId) {
        await updateWord(editId, input);
        navigate(`word/${editId}`);
      } else {
        await createWord(input);
        rememberLastUsed(language, tags);
        // F-01: keep the form open for rapid entry
        setWord("");
        setTranslation("");
        setTranscription("");
        setNote("");
        setExamples([]);
        setExampleInput("");
        setToast(t("add.savedAnother"));
        window.setTimeout(() => setToast(""), 2000);
        focusWord();
      }
    } catch {
      setError(t("common.error"));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    await deleteWord(editId);
    navigate("");
  };

  const back = () => navigate(editId ? `word/${editId}` : "");

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.back")} onClick={back}>
          ‹
        </IconButton>
        <h1 className="text-lg font-extrabold">{t(editId ? "add.title.edit" : "add.title.new")}</h1>
        {toast && (
          <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{toast}</span>
        )}
      </header>

      <Card className="space-y-3">
        <Field label={t("word.word")}>
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t("word.word")}
            aria-label={t("word.word")}
            autoFocus
          />
        </Field>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t("word.translation")}>
              <Input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder={t("word.translation")}
                aria-label={t("word.translation")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !expanded) void save();
                }}
              />
            </Field>
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => void pasteFromClipboard()} aria-label={t("add.paste")}>
            📋 {t("add.paste")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-accent">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void save()}>
            {t("word.save")}
          </Button>
          <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {t(expanded ? "add.less" : "add.more")}
          </Button>
        </div>
      </Card>

      {expanded && (
        <Card className="mt-3 space-y-3">
          <Field label={t("word.transcription")}>
            <Input
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="[ˈwɜːrd]"
              aria-label={t("word.transcription")}
            />
          </Field>

          <Field label={t("word.note")}>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label={t("word.note")}
            />
          </Field>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
              {t("word.tags")}
            </span>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {tags.map((tg) => (
                  <Chip key={tg} label={tg} active onClick={() => setTags(tags.filter((x) => x !== tg))} />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder={t("add.tagPlaceholder")}
                aria-label={t("word.tags")}
              />
              <Button variant="outline" className="shrink-0" onClick={addTag} aria-label={t("add.tagPlaceholder")}>
                ＋
              </Button>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
              {t("word.examples")}
            </span>
            {examples.length > 0 && (
              <ul className="mb-2 space-y-1">
                {examples.map((ex, i) => (
                  <li key={`${i}-${ex}`} className="flex items-center justify-between gap-2 rounded-xl bg-cream-2 px-3 py-2 text-sm dark:bg-[#332a20]">
                    <span>{ex}</span>
                    <button
                      aria-label={`${t("common.close")} ${i + 1}`}
                      className="text-ink-soft dark:text-[#b7a895]"
                      onClick={() => setExamples(examples.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={exampleInput}
                onChange={(e) => setExampleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExample())}
                placeholder={t("add.examplePlaceholder")}
                aria-label={t("word.examples")}
              />
              <Button variant="outline" className="shrink-0" onClick={addExample} aria-label={t("add.examplePlaceholder")}>
                ＋
              </Button>
            </div>
          </div>

          <Field label={t("word.language")}>
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              list="add-language-options"
              placeholder="en · fr · de …"
              aria-label={t("word.language")}
            />
            <datalist id="add-language-options">
              {languages.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>

          {editId && (
            <div className="border-t border-line pt-3 dark:border-[#3d3226]">
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 !text-accent"
                    onClick={() => void remove()}
                    aria-label={t("word.delete")}
                  >
                    {t("word.delete")}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    {t("common.close")}
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" className="!text-accent" onClick={() => setConfirmDelete(true)} aria-label={t("word.delete")}>
                  🗑 {t("word.delete")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
