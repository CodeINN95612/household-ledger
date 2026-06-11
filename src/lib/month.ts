/**
 * Settlement periods are calendar months identified by a "monthKey" string in
 * the form "YYYY-MM" (e.g. "2026-06").
 */

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(key: string): boolean {
  return MONTH_KEY_RE.test(key);
}

/** The monthKey for a given date (defaults to now), in local time. */
export function currentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** monthKey shifted by `delta` months (negative = past), e.g. previous month. */
export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return currentMonthKey(d);
}

/** Human label for a monthKey, e.g. "2026-06" → "June 2026". */
export function formatMonthKey(key: string, locale = "en-US"): string {
  if (!isValidMonthKey(key)) return key;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

/** Derive the monthKey for an expense date (a Date or ISO/`yyyy-mm-dd` string). */
export function monthKeyForDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return currentMonthKey(d);
}
