// Settings — spec: plans/07-PRD.md §2.7 (F-60..F-65), §3.1 screen 8
import { useEffect, useRef, useState } from "react";
import type { AiSettings, ReviewMode, Settings } from "../../types";
import { allLanguages, deleteAllData, listWords, saveSettings } from "../../db/repo";
import { exportWords } from "../../core/parsers";
import { listVoices, speechAvailable } from "../../platform/speech";
import { t } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { Button, Card, Chip, Field, IconButton, Input } from "../components";
import { navigate } from "../../App";

const APP_VERSION = "0.1.0";

const MODE_KEYS: { mode: ReviewMode; key: StringKey }[] = [
  { mode: "flashcard", key: "study.mode.flashcard" },
  { mode: "choice", key: "study.mode.choice" },
  { mode: "typing", key: "study.mode.typing" },
  { mode: "listening", key: "study.mode.listening" },
  { mode: "matching", key: "study.mode.matching" },
];

const DEFAULT_AI: AiSettings = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  consent: false,
};

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsScreen({
  settings,
  onSettings,
}: {
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deletedMsg, setDeletedMsg] = useState(false);
  const [installEvt, setInstallEvt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const saveTimer = useRef(0);
  const msgTimer = useRef(0);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    void saveSettings(next);
    onSettings(next);
    setSaved(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaved(false), 1200);
  };

  const flash = (setter: (v: string) => void, msg: string, ms = 2600) => {
    setter(msg);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setter(""), ms);
  };

  useEffect(() => {
    void allLanguages().then(setLanguages);
    if (!speechAvailable()) return;
    const refresh = () => setVoices(listVoices());
    refresh();
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const ai = settings.ai ?? DEFAULT_AI;
  const setAi = (patch: Partial<AiSettings>) => update({ ai: { ...ai, ...patch } });

  const applyAppearance = (appearance: Settings["appearance"]) => {
    update({ appearance });
    const dark =
      appearance === "dark" ||
      (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };

  const testAi = async () => {
    setTesting(true);
    setAiStatus("");
    try {
      const res =
        ai.provider === "gemini"
          ? await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:generateContent?key=${encodeURIComponent(ai.apiKey)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK." }] }] }),
              }
            )
          : await fetch(`${ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ai.apiKey}`,
              },
              body: JSON.stringify({
                model: ai.model,
                messages: [{ role: "user", content: "Reply with OK." }],
                max_tokens: 5,
              }),
            });
      setAiStatus(res.ok ? t("settings.ai.testOk") : t("settings.ai.testFail", { msg: String(res.status) }));
    } catch (e) {
      setAiStatus(t("settings.ai.testFail", { msg: (e as Error).message }));
    } finally {
      setTesting(false);
    }
  };

  const exportJson = async () => {
    const words = await listWords({ limit: 100000 });
    const stamp = new Date().toISOString().slice(0, 10);
    download(`vocabulary-diary-${stamp}.json`, exportWords(words, "json"));
    flash(setExportMsg, t("settings.exportDone", { n: words.length }));
  };

  const deleteEverything = async () => {
    if (deleteText !== "DELETE") return;
    await deleteAllData();
    setDeletedMsg(true);
    setShowDelete(false);
    setDeleteText("");
  };

  const num = (value: string, min: number, max: number): number =>
    Math.max(min, Math.min(max, Number(value) || min));

  const sectionTitle = "text-xs font-semibold uppercase tracking-widest text-ink-soft dark:text-[#b7a895]";

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.back")} onClick={() => navigate("")}>
          ‹
        </IconButton>
        <h1 className="text-lg font-extrabold">{t("settings.title")}</h1>
        {saved && (
          <span role="status" className="ml-auto text-xs font-semibold text-accent">
            {t("settings.saved")}
          </span>
        )}
      </header>

      {/* Study */}
      <div className={`mb-2 mt-2 ${sectionTitle}`}>{t("settings.study")}</div>
      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label={t("settings.newPerDay")}>
            <Input
              type="number"
              min={0}
              value={settings.newPerDay}
              onChange={(e) => update({ newPerDay: num(e.target.value, 0, 999) })}
              aria-label={t("settings.newPerDay")}
            />
          </Field>
          <Field label={t("settings.maxReviewsPerDay")}>
            <Input
              type="number"
              min={0}
              value={settings.maxReviewsPerDay}
              onChange={(e) => update({ maxReviewsPerDay: num(e.target.value, 0, 9999) })}
              aria-label={t("settings.maxReviewsPerDay")}
            />
          </Field>
          <Field label={t("settings.dailyGoal")}>
            <Input
              type="number"
              min={1}
              value={settings.dailyGoal}
              onChange={(e) => update({ dailyGoal: num(e.target.value, 1, 1000) })}
              aria-label={t("settings.dailyGoal")}
            />
          </Field>
        </div>
        <Field label={t("settings.dayStartHour")}>
          <select
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-accent dark:bg-[#241c14] dark:border-[#3d3226] dark:text-cream"
            value={settings.dayStartHour}
            onChange={(e) => update({ dayStartHour: num(e.target.value, 0, 23) })}
            aria-label={t("settings.dayStartHour")}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className={`mb-1 block ${sectionTitle}`}>{t("settings.preferredModes")}</span>
          <div className="flex flex-wrap gap-1">
            {MODE_KEYS.map(({ mode, key }) => (
              <Chip
                key={mode}
                label={t(key)}
                active={settings.preferredModes.includes(mode)}
                onClick={() =>
                  update({
                    preferredModes: settings.preferredModes.includes(mode)
                      ? settings.preferredModes.filter((m) => m !== mode)
                      : [...settings.preferredModes, mode],
                  })
                }
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Audio */}
      <div className={`mb-2 mt-5 ${sectionTitle}`}>{t("settings.audio")}</div>
      <Card className="space-y-3">
        <Field label={`${t("settings.voiceRate")} (${settings.voiceRate.toFixed(1)}×)`}>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.voiceRate}
            onChange={(e) => update({ voiceRate: Number(e.target.value) })}
            className="w-full accent-[#c4552d]"
            aria-label={t("settings.voiceRate")}
          />
        </Field>
        {languages.map((lang) => {
          const prefix = lang.split("-")[0].toLowerCase();
          const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
          return (
            <Field key={lang} label={t("settings.voiceFor", { lang })}>
              <select
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-accent dark:bg-[#241c14] dark:border-[#3d3226] dark:text-cream"
                value={settings.voiceByLang[lang] ?? ""}
                onChange={(e) =>
                  update({ voiceByLang: { ...settings.voiceByLang, [lang]: e.target.value } })
                }
                aria-label={t("settings.voiceFor", { lang })}
              >
                <option value="">{t("settings.voice.none")}</option>
                {matches.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </Field>
          );
        })}
        {languages.length === 0 && (
          <p className="text-xs text-ink-soft dark:text-[#b7a895]">{t("settings.voice.none")}</p>
        )}
      </Card>

      {/* Appearance */}
      <div className={`mb-2 mt-5 ${sectionTitle}`}>{t("settings.appearance")}</div>
      <Card className="flex gap-1">
        {(
          [
            { v: "system", key: "settings.appearance.system" },
            { v: "light", key: "settings.appearance.light" },
            { v: "dark", key: "settings.appearance.dark" },
          ] as { v: Settings["appearance"]; key: StringKey }[]
        ).map((a) => (
          <Chip key={a.v} label={t(a.key)} active={settings.appearance === a.v} onClick={() => applyAppearance(a.v)} />
        ))}
      </Card>

      {/* AI */}
      <div className={`mb-2 mt-5 ${sectionTitle}`}>{t("settings.ai")}</div>
      <Card className="space-y-3">
        <div className="flex gap-1">
          <Chip label="OpenAI" active={ai.provider === "openai"} onClick={() => setAi({ provider: "openai" })} />
          <Chip label="Gemini" active={ai.provider === "gemini"} onClick={() => setAi({ provider: "gemini" })} />
        </div>
        {ai.provider === "openai" && (
          <Field label="Base URL">
            <Input value={ai.baseUrl} onChange={(e) => setAi({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" aria-label="Base URL" />
          </Field>
        )}
        <Field label="API key">
          <Input type="password" value={ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value })} autoComplete="off" aria-label="API key" />
        </Field>
        <Field label={t("settings.ai.model")}>
          <Input
            value={ai.model}
            onChange={(e) => setAi({ model: e.target.value })}
            placeholder={ai.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini"}
            aria-label={t("settings.ai.model")}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={ai.consent}
            onChange={(e) => setAi({ consent: e.target.checked })}
            className="mt-1 accent-[#c4552d]"
            aria-label={t("settings.ai.consent")}
          />
          <span className="text-ink-soft dark:text-[#b7a895]">{t("settings.ai.consent")}</span>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={testing || !ai.apiKey || !ai.model} onClick={() => void testAi()}>
            {testing ? t("common.loading") : t("settings.ai.test")}
          </Button>
          {aiStatus && (
            <span role="status" className={`text-xs font-semibold ${aiStatus.includes("✓") ? "text-accent" : "text-ink-soft dark:text-[#b7a895]"}`}>
              {aiStatus}
            </span>
          )}
        </div>
      </Card>

      {/* Data */}
      <div className={`mb-2 mt-5 ${sectionTitle}`}>{t("settings.data")}</div>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportJson()}>⬇️ {t("settings.export")}</Button>
          <Button variant="outline" onClick={() => navigate("import")}>
            ⬆️ {t("settings.import")}
          </Button>
        </div>
        {exportMsg && (
          <p role="status" className="text-xs font-semibold text-accent">
            {exportMsg}
          </p>
        )}
        <p className="text-xs text-ink-soft dark:text-[#b7a895]">💡 {t("settings.backupNote")}</p>
        <div className="border-t border-line pt-3 dark:border-[#3d3226]">
          {!showDelete ? (
            <Button variant="ghost" className="!text-accent" onClick={() => setShowDelete(true)} aria-label={t("settings.deleteAll")}>
              🗑 {t("settings.deleteAll")}
            </Button>
          ) : (
            <div className="space-y-2">
              <Field label={t("settings.deleteAll.confirm")}>
                <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" aria-label={t("settings.deleteAll.confirm")} />
              </Field>
              <div className="flex gap-2">
                <Button disabled={deleteText !== "DELETE"} onClick={() => void deleteEverything()}>
                  {t("settings.deleteAll")}
                </Button>
                <Button variant="ghost" onClick={() => setShowDelete(false)}>
                  {t("common.close")}
                </Button>
              </div>
            </div>
          )}
          {deletedMsg && (
            <p role="status" className="mt-2 text-xs font-semibold text-accent">
              {t("settings.deleted")}
            </p>
          )}
        </div>
      </Card>

      {/* About */}
      <div className={`mb-2 mt-5 ${sectionTitle}`}>{t("settings.about")}</div>
      <Card className="space-y-2 text-sm">
        <div className="font-bold">Vocabulary Diary · {t("settings.version", { v: APP_VERSION })}</div>
        <p className="text-xs text-ink-soft dark:text-[#b7a895]">{t("settings.privacy")}</p>
        {installEvt ? (
          <Button variant="outline" onClick={() => void installEvt.prompt()}>
            📲 {t("settings.install.ready")}
          </Button>
        ) : (
          <p className="text-xs text-ink-soft dark:text-[#b7a895]">📲 {t("settings.install.hint")}</p>
        )}
      </Card>
    </div>
  );
}
