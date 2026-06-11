import { formatCents } from "@/lib/money";

interface MoneyProps {
  cents: number;
  /** Show an explicit + for positive values (used for balances). */
  signed?: boolean;
  className?: string;
}

/** Renders integer cents as a monospaced, tabular currency figure. */
export function Money({ cents, signed = false, className = "" }: MoneyProps) {
  const formatted = formatCents(Math.abs(cents));
  const sign = cents < 0 ? "−" : signed ? "+" : "";
  return (
    <span className={`tabular ${className}`}>
      {sign}
      {formatted}
    </span>
  );
}
