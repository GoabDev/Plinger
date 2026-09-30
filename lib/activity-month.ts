export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function isActivityMonth(value: unknown): value is string {
  return typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(value);
}

export function resolveActivityMonth(value: unknown, now = new Date()) {
  return value === "all" || isActivityMonth(value) ? value : currentMonth(now);
}

export function monthBounds(month: string) {
  if (!isActivityMonth(month)) throw new Error("Invalid activity month");
  const start = `${month}-01T00:00:00.000Z`;
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: next.toISOString() };
}

export function monthQuery(month: string, column: string): Record<string, string> {
  if (month === "all") return {};
  const { start, end } = monthBounds(month);
  return { and: `(${column}.gte.${start},${column}.lt.${end})` };
}

export function inActivityMonth(value: string | null | undefined, month: string) {
  if (month === "all") return true;
  const { start, end } = monthBounds(month);
  const timestamp = value ? Date.parse(value) : NaN;
  return timestamp >= Date.parse(start) && timestamp < Date.parse(end);
}

export function monthSearch(month: string, field: "created" | "closed") {
  const { start, end } = monthBounds(month);
  const last = new Date(Date.parse(end) - 1).toISOString().slice(0, 10);
  return `${field}:${start.slice(0, 10)}..${last}`;
}
