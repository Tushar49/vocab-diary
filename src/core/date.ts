/** Local-date helpers that respect a configurable day-start hour. */

export function todayKey(dayStartHour: number, ts: number = Date.now()): string {
  const d = new Date(ts - dayStartHour * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function relativeDay(ts: number, now = Date.now()): string {
  const day = 86_400_000;
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diff = Math.round((startOf(now) - startOf(ts)) / day);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} wk ago`;
  if (diff < 365) return `${Math.floor(diff / 30)} mo ago`;
  return `${Math.floor(diff / 365)} yr ago`;
}
