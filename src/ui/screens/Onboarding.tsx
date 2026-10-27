// First-run onboarding: what it is → add first word → install — spec: PRD §3.1 screen 9
import { useState } from "react";
import type { Settings } from "../../types";
import { countWords, createWord, saveSettings } from "../../db/repo";
import { t } from "../../i18n";
import { Button, Card, Field, Input } from "../components";

export default function Onboarding({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [step, setStep] = useState(1);
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const next = { ...settings, onboarded: true };
    await saveSettings(next);
    onSettings(next);
    window.location.hash = "#/";
  };

  const saveFirst = async () => {
    if (!word.trim() || !translation.trim()) {
      setError(t("word.required"));
      return;
    }
    setBusy(true);
    try {
      await createWord({ word, translation });
      setSavedCount(await countWords());
      setStep(3);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    setError("");
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft dark:text-[#b7a895]">
        {t("onboarding.step", { n: step })} · 📖 {t("app.name")}
      </div>

      {step === 1 && (
        <Card className="space-y-4 text-center">
          <div className="text-5xl">📖</div>
          <h1 className="text-2xl font-extrabold">{t("onboarding.welcome.title")}</h1>
          <p className="text-sm text-ink-soft dark:text-[#b7a895]">{t("onboarding.welcome.body")}</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={goNext}>
              {t("onboarding.next")} →
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-3">
          <h1 className="text-center text-xl font-extrabold">{t("onboarding.addFirst.title")}</h1>
          <p className="text-center text-sm text-ink-soft dark:text-[#b7a895]">{t("onboarding.addFirst.body")}</p>
          <Field label={t("word.word")}>
            <Input value={word} onChange={(e) => setWord(e.target.value)} autoFocus aria-label={t("word.word")} />
          </Field>
          <Field label={t("word.translation")}>
            <Input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveFirst()}
              aria-label={t("word.translation")}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-accent">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={goBack} aria-label={t("nav.back")}>
              ‹
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => void saveFirst()}>
              {t("word.save")}
            </Button>
            <Button variant="ghost" onClick={goNext}>
              {t("onboarding.skip")}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 text-center">
          <div className="text-5xl">📲</div>
          <h1 className="text-2xl font-extrabold">{t("onboarding.install.title")}</h1>
          <p className="text-sm text-ink-soft dark:text-[#b7a895]">{t("onboarding.install.body")}</p>
          {savedCount !== null && (
            <p className="text-sm font-semibold text-accent">{t("library.count", { n: savedCount })}</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={goBack} aria-label={t("nav.back")}>
              ‹
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => void finish()}>
              {t("onboarding.done")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
