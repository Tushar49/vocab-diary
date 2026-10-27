// Translate + examples via BYOK AI — spec: plans/07-PRD.md §2.1 (F-08), §3.2 translate flow
import { useState } from "react";
import type { AiSettings, Settings } from "../../types";
import { createWord } from "../../db/repo";
import { t } from "../../i18n";
import { Button, Card, Field, IconButton, Textarea } from "../components";
import { navigate } from "../../App";

const PROMPT = `You are a bilingual dictionary. Translate the user's text and reply with ONLY a JSON object, no prose, no code fences:
{"translation": "<translation>", "transcription": "<IPA transcription of the original, or null>", "examples": ["<example sentence using the original>", "<example 2>", "<example 3>", "<example 4>"]}
Give exactly 4 short, natural example sentences.`;

const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]";

interface TranslateResult {
  translation: string;
  transcription?: string;
  examples: string[];
}

/** Tolerant JSON extraction — models occasionally wrap objects in code fences. */
function extractJson(raw: string): TranslateResult {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const data = JSON.parse(text) as {
    translation?: unknown;
    transcription?: unknown;
    examples?: unknown;
  };
  const translation = typeof data.translation === "string" ? data.translation : "";
  if (!translation) throw new Error("missing translation");
  const examples = Array.isArray(data.examples)
    ? data.examples.filter((x): x is string => typeof x === "string").slice(0, 4)
    : [];
  return {
    translation,
    transcription: typeof data.transcription === "string" && data.transcription ? data.transcription : undefined,
    examples,
  };
}

async function callAi(ai: AiSettings, text: string): Promise<TranslateResult> {
  const res =
    ai.provider === "gemini"
      ? await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:generateContent?key=${encodeURIComponent(ai.apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: `${PROMPT}\n\n${text}` }] }] }),
          }
        )
      : await fetch(`${ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
          body: JSON.stringify({
            model: ai.model,
            messages: [
              { role: "system", content: PROMPT },
              { role: "user", content: text },
            ],
          }),
        });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  };
  const raw =
    data.choices?.[0]?.message?.content ??
    data.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");
  if (typeof raw !== "string" || !raw.trim()) throw new Error("empty reply");
  return extractJson(raw);
}

export default function Translate({ settings, initialText }: { settings: Settings; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ai = settings.ai;
  const ready = !!ai && !!ai.apiKey && !!ai.model && ai.consent;

  const run = async () => {
    if (!text.trim()) return;
    if (!ready || !ai) {
      setError(t("translate.needAi"));
      return;
    }
    setError("");
    setResult(null);
    setBusy(true);
    try {
      setResult(await callAi(ai, text.trim()));
    } catch (e) {
      setError(`${t("common.error")} — ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveToDiary = async () => {
    if (!result) return;
    const id = await createWord({
      word: text.trim(),
      translation: result.translation,
      transcription: result.transcription,
      examples: result.examples,
    });
    navigate(`word/${id}`);
  };

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      <header className="flex items-center gap-2 py-4">
        <IconButton aria-label={t("nav.back")} onClick={() => navigate("")}>
          ‹
        </IconButton>
        <h1 className="text-lg font-extrabold">🌐 {t("translate.title")}</h1>
      </header>

      {!ready && (
        <Card className="mb-3 border-accent/40">
          <p className="text-sm text-ink-soft dark:text-[#b7a895]">{t("translate.needAi")}</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate("settings")}>
            {t("settings.title")} ›
          </Button>
        </Card>
      )}

      <Card className="space-y-3">
        <Field label={t("translate.input")}>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("translate.input")}
            aria-label={t("translate.input")}
          />
        </Field>
        <Button className="w-full" disabled={busy || !text.trim()} onClick={() => void run()}>
          {busy ? t("common.loading") : t("translate.translate")}
        </Button>
        <Button variant="outline" className="w-full" disabled aria-label={t("translate.photo")}>
          📷 {t("translate.photo")}
        </Button>
        <p className="text-xs text-ink-soft dark:text-[#b7a895]">🔒 {t("translate.disclosure")}</p>
        {error && (
          <p role="alert" className="text-sm font-medium text-accent">
            {error}
          </p>
        )}
      </Card>

      {result && (
        <Card className="mt-3 space-y-2">
          <div className={sectionTitle}>{t("translate.result")}</div>
          <div className="text-xl font-extrabold">{result.translation}</div>
          {result.transcription && (
            <div className="text-sm italic text-ink-soft dark:text-[#b7a895]">[{result.transcription}]</div>
          )}
          {result.examples.length > 0 && (
            <div>
              <div className={`mb-1 ${sectionTitle}`}>{t("word.examples")}</div>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {result.examples.map((ex, i) => (
                  <li key={`${i}-${ex}`}>{ex}</li>
                ))}
              </ul>
            </div>
          )}
          <Button className="mt-2 w-full" onClick={() => void saveToDiary()}>
            ＋ {t("translate.saveToDiary")}
          </Button>
        </Card>
      )}
    </div>
  );
}
