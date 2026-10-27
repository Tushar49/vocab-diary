import { strings, type StringKey } from "./strings";

export type { StringKey } from "./strings";

let lang = "en";

export function setLang(code: string): void {
  if (strings[code]) lang = code;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const dict = strings[lang] ?? strings.en;
  let s: string = dict[key] ?? strings.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
