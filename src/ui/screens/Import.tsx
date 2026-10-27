// Import — spec: plans/07-PRD.md §2.1 (F-05), §3.2 import flow
import { useRef, useState } from "react";
import type { Settings } from "../../types";
import { importWords, type DuplicatePolicy, type ImportSummary } from "../../db/repo";
import { parseImport, type ParseResult } from "../../core/parsers";
import { extractPdfLines, parsePdfLines } from "../../core/pdfImport";
import { aiParseWords, aiReady } from "../../ai/client";
import { t } from "../../i18n";
import { Button, Card, Chip, IconButton, Textarea } from "../components";
import { navigate } from "../../App";

type Phase = "pick" | "preview" | "done";

export default function ImportScreen({ settings }: { settings: Settings }) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [paste, setPaste] = useState("");
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadResult = (r: ParseResult) => {
    setParsed(r);
    setPhase("preview");
  };

  const onFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setBusy(true);
      try {
        const lines = await extractPdfLines(file);
        const r = parsePdfLines(lines);
        if (r.words.length) {
          loadResult(r);
        } else {
          // foreign PDF layout: dump raw text into the paste box for generic/AI parse
          setPaste(
            lines
              .filter((l) => l.size <= 20 && l.size > 8.5)
              .map((l) => l.text)
              .join("\n")
          );
          setPhase("pick");
        }
      } catch {
        loadResult({ words: [], errors: [{ line: 0, message: t("import.pdfFail") }] });
        setPhase("preview");
      } finally {
        setBusy(false);
      }
      return;
    }
    const content = await file.text();
    loadResult(parseImport(file.name, content));
  };

  const onPaste = () => {
    loadResult(parseImport("pasted.txt", paste));
  };

  const onAiParse = async () => {
    if (!aiReady(settings.ai)) {
      setAiErr(false);
      setParsed({ words: [], errors: [{ line: 0, message: t("import.aiParse.needAi") }] });
      setPhase("preview");
      return;
    }
    setBusy(true);
    setAiErr(false);
    try {
      const words = await aiParseWords(settings.ai!, paste);
      loadResult({ words, errors: [] });
    } catch {
      setAiErr(true);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!parsed || !parsed.words.length) return;
    setBusy(true);
    try {
      setSummary(await importWords(parsed.words, policy));
      setPhase("done");
    } catch {
      setParsed(null);
      setPhase("pick");
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setParsed(null);
    setPaste("");
    setSummary(null);
    setPhase("pick");
  };

  const header = (
    <header className="flex items-center gap-2 py-4">
      <IconButton aria-label={t("nav.back")} onClick={() => navigate("settings")}>
        ‹
      </IconButton>
      <h1 className="text-lg font-extrabold">{t("import.title")}</h1>
    </header>
  );

  if (phase === "done" && summary) {
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
        {header}
        <Card className="space-y-2">
          <div className="text-lg font-extrabold">✅ {t("import.done", { ...summary })}</div>
          <Button className="mt-2 w-full" onClick={() => navigate("settings")}>
            {t("common.ok")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={again}>
            {t("import.again")}
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === "preview" && parsed) {
    const words = parsed.words;
    const errors = parsed.errors;
    return (
      <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
        {header}
        <Card className="space-y-3">
          <div className="text-sm font-bold">{t("import.preview", { n: words.length })}</div>
          {errors.length > 0 && (
            <div className="rounded-xl bg-accent/10 p-3 text-xs text-accent">
              <div className="font-bold">{t("import.errors", { n: errors.length })}</div>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={`${e.line}-${i}`}>
                    {e.line} · {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {words.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-cream-2 p-3 text-sm dark:bg-[#332a20]">
              {words.slice(0, 20).map((w, i) => (
                <li key={`${w.word}-${i}`} className="flex justify-between gap-3">
                  <span className="font-bold">{w.word}</span>
                  <span className="truncate text-ink-soft dark:text-[#b7a895]">{w.translation}</span>
                </li>
              ))}
              {words.length > 20 && (
                <li className="text-xs text-ink-soft dark:text-[#b7a895]">… +{words.length - 20}</li>
              )}
            </ul>
          )}
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-[#b7a895]">
              {t("import.policy")}
            </div>
            <div className="flex gap-1">
              {(
                [
                  ["skip", "import.policy.skip"],
                  ["merge", "import.policy.merge"],
                  ["replace", "import.policy.replace"],
                ] as [DuplicatePolicy, `import.policy.${DuplicatePolicy}`][]
              ).map(([p, key]) => (
                <Chip key={p} label={t(key)} active={policy === p} onClick={() => setPolicy(p)} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy || !words.length} onClick={() => void commit()}>
              {busy ? t("common.loading") : t("import.commit")}
            </Button>
            <Button variant="ghost" onClick={again}>
              {t("common.close")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pb-28">
      {header}
      <Card className="space-y-3">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,.json,.md,.markdown,.pdf,text/csv,text/plain,application/json,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        <Button className="w-full" onClick={() => fileInput.current?.click()}>
          📁 {t("import.chooseFile")}
        </Button>
        <p className="text-center text-xs text-ink-soft dark:text-[#b7a895]">{t("import.fileHint")}</p>
        <div className="border-t border-line pt-3 dark:border-[#3d3226]">
          <Textarea
            rows={5}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={t("import.paste")}
            aria-label={t("import.paste")}
          />
          <Button variant="outline" className="mt-2 w-full" disabled={!paste.trim()} onClick={onPaste}>
            {t("import.parse")}
          </Button>
          <Button
            variant="ghost"
            className="mt-1 w-full"
            disabled={!paste.trim() || busy}
            onClick={() => void onAiParse()}
          >
            {busy ? t("common.loading") : t("import.aiParse")}
          </Button>
          <p className="text-center text-[11px] text-ink-soft/80 dark:text-[#8f8272]">
            {aiErr || aiReady(settings.ai) ? t("import.aiParse.disclosure") : ""}
          </p>
        </div>
      </Card>
    </div>
  );
}
