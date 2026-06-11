/**
 * Money helpers. Everything is stored and computed as integer cents; we only
 * convert to/from a human dollar string at the UI boundary.
 */

/** Format integer cents as a currency string, e.g. 123456 → "$1,234.56". */
export function formatCents(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Parse a user-entered dollar amount (e.g. "1,234.56" or "12") into integer
 * cents. Returns null if the input isn't a valid non-negative money value.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Avoid float rounding by splitting on the decimal point.
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isFinite(cents) ? cents : null;
}

/** Format integer cents as a plain decimal for input fields, e.g. 123456 → "1234.56". */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}
