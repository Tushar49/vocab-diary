/** Text-to-speech via the Web Speech API (system voices, no downloads). */

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  return window.speechSynthesis.getVoices();
}

function pickVoice(voiceByLang: Record<string, string>, lang?: string): SpeechSynthesisVoice | undefined {
  const voices = listVoices();
  if (!voices.length) return undefined;
  if (lang && voiceByLang[lang]) {
    const named = voices.find((v) => v.name === voiceByLang[lang]);
    if (named) return named;
  }
  if (lang) {
    const prefix = lang.split("-")[0].toLowerCase();
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (match) return match;
  }
  return voices.find((v) => v.default) ?? voices[0];
}

export function speak(text: string, opts: { lang?: string; rate?: number; voiceByLang?: Record<string, string> } = {}): void {
  if (!speechAvailable() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(opts.voiceByLang ?? {}, opts.lang);
  if (voice) u.voice = voice;
  if (opts.lang) u.lang = opts.lang;
  u.rate = opts.rate ?? 1;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
