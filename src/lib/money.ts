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

/**
 * Compute the per-installment amount for a financed expense.
 * annualRateBps: annual interest rate in basis points (0 = interest-free).
 * Uses standard amortization formula when rate > 0.
 */
export function computeInstallmentCents(
  totalCents: number,
  installments: number,
  annualRateBps: number,
): number {
  if (installments <= 1) return totalCents;
  if (annualRateBps === 0) return Math.round(totalCents / installments);
  const r = annualRateBps / 10000 / 12; // monthly rate
  const factor = Math.pow(1 + r, installments);
  return Math.round((totalCents * r * factor) / (factor - 1));
}
