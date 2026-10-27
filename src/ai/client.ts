/** Minimal BYOK AI client — plain fetch, no SDK, key stays local. */
import type { AiSettings, ParsedWord } from "../types";

export function aiReady(ai?: AiSettings): boolean {
  return !!ai && ai.consent && !!ai.apiKey.trim() && !!ai.model.trim();
}

/** Returns the raw text content of a completion. Throws on HTTP/network errors. */
export async function aiComplete(ai: AiSettings, system: string, user: string): Promise<string> {
  if (ai.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:generateContent?key=${encodeURIComponent(ai.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const j = await res.json();
    const parts = j?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: { text?: string }) => p.text ?? "").join("");
  }

  const base = (ai.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

/** Extract the first JSON value from a possibly fence-wrapped reply. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = Math.min(
    ...[stripped.indexOf("{"), stripped.indexOf("[")].filter((i) => i >= 0).concat([Infinity])
  );
  if (start === Infinity) throw new Error("No JSON in reply");
  const open = stripped[start];
  const close = open === "{" ? "}" : "]";
  const end = stripped.lastIndexOf(close);
  return JSON.parse(stripped.slice(start, end + 1));
}

const PARSE_SYSTEM =
  "You extract vocabulary entries from messy user text. Reply with ONLY a JSON array, each item: " +
  '{"word": string, "translation": string, "transcription"?: string, "note"?: string, "tags"?: string[]}. ' +
  "No commentary, no markdown.";

export async function aiParseWords(ai: AiSettings, text: string): Promise<ParsedWord[]> {
  const reply = await aiComplete(ai, PARSE_SYSTEM, text.slice(0, 12_000));
  const data = extractJson(reply);
  const arr = Array.isArray(data) ? data : Array.isArray((data as { words?: unknown }).words) ? (data as { words: unknown[] }).words : [];
  const out: ParsedWord[] = [];
  for (const row of arr as Record<string, unknown>[]) {
    const word = String(row.word ?? "").trim();
    const translation = String(row.translation ?? "").trim();
    if (!word || !translation) continue;
    out.push({
      word,
      translation,
      transcription: row.transcription != null ? String(row.transcription) : undefined,
      note: row.note != null ? String(row.note) : undefined,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : undefined,
    });
  }
  if (!out.length) throw new Error("AI returned no entries");
  return out;
}
