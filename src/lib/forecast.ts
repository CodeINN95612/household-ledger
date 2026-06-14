/**
 * Forecast engine — spec §7 forecastSharedSpend + computeFloat.
 *
 * Pure, DB-agnostic, integer cents throughout.
 *
 * forecastSharedSpend: derives a shared-spend forecast from expense history.
 *   - "Fixed" expenses: same description recurring monthly (or isRecurringFixed=true).
 *     Used at face value in the forecast.
 *   - "Variable" expenses: everything else. 3-month rolling average per description
 *     group (falls back to 6-month if < 3 months with data). Low-confidence when
 *     fewer than 3 months of history total.
 *
 * computeFloat: derives the fronting partner's outstanding float and recommended reserve.
 */

export interface HistoryExpense {
  monthKey: string; // "YYYY-MM"
  description: string;
  amountCents: number;
  type: "shared" | "personal";
  isRecurringFixed: boolean | null; // null = auto-detect
}

export interface ForecastLine {
  description: string;
  amountCents: number;
  isFixed: boolean;
  isLowConfidence: boolean; // true when derived from < 3 months of variable data
}

export interface SharedSpendForecast {
  lines: ForecastLine[];
  totalFixedCents: number;
  totalVariableCents: number;
  totalCents: number;
  isLowConfidence: boolean; // true when overall history < 3 months
  monthsOfHistory: number;
}

/**
 * Return sorted, deduplicated monthKeys present in the history.
 */
function uniqueMonths(expenses: HistoryExpense[]): string[] {
  return [...new Set(expenses.map((e) => e.monthKey))].sort();
}

/**
 * Auto-detect whether a description group is "fixed": it must appear in at
 * least 3 of the most-recent 6 months at roughly the same amount (variance ≤ 5%).
 * Manual override (isRecurringFixed) always wins.
 */
function detectFixed(
  description: string,
  byMonth: Map<string, number>, // monthKey → total amountCents for this description
  recentMonths: string[],
): boolean {
  const recent = recentMonths.slice(-6);
  const values = recent.map((m) => byMonth.get(m) ?? 0).filter((v) => v > 0);
  if (values.length < 3) return false;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg === 0) return false;
  const variance = values.every((v) => Math.abs(v - avg) / avg <= 0.05);
  return variance;
}

export function forecastSharedSpend(expenses: HistoryExpense[]): SharedSpendForecast {
  const shared = expenses.filter((e) => e.type === "shared");
  const allMonths = uniqueMonths(shared);
  const monthsOfHistory = allMonths.length;
  const isLowConfidence = monthsOfHistory < 3;

  // Group by description: monthKey → amountCents, and manual override
  type DescGroup = {
    description: string;
    byMonth: Map<string, number>;
    manualFixed: boolean | null;
  };
  const groups = new Map<string, DescGroup>();

  for (const e of shared) {
    const key = e.description.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { description: e.description, byMonth: new Map(), manualFixed: null });
    }
    const g = groups.get(key)!;
    g.byMonth.set(e.monthKey, (g.byMonth.get(e.monthKey) ?? 0) + e.amountCents);
    // Manual override: last value wins (consistent within a description)
    if (e.isRecurringFixed !== null) g.manualFixed = e.isRecurringFixed;
  }

  const lines: ForecastLine[] = [];

  for (const g of groups.values()) {
    const isFixed =
      g.manualFixed !== null ? g.manualFixed : detectFixed(g.description, g.byMonth, allMonths);

    if (isFixed) {
      // Use the most-recent observed amount for fixed lines
      const lastMonth = [...g.byMonth.keys()].sort().pop()!;
      lines.push({
        description: g.description,
        amountCents: g.byMonth.get(lastMonth) ?? 0,
        isFixed: true,
        isLowConfidence: false,
      });
    } else {
      // Rolling average: prefer last 3 months, fall back to last 6
      const windows = [3, 6];
      let avg = 0;
      let lowConfidence = true;
      for (const w of windows) {
        const recentW = allMonths.slice(-w);
        const vals = recentW.map((m) => g.byMonth.get(m) ?? 0);
        const nonZero = vals.filter((v) => v > 0);
        if (nonZero.length > 0) {
          avg = Math.round(vals.reduce((a, b) => a + b, 0) / recentW.length);
          lowConfidence = nonZero.length < 3;
          break;
        }
      }
      if (avg > 0) {
        lines.push({
          description: g.description,
          amountCents: avg,
          isFixed: false,
          isLowConfidence: isLowConfidence || lowConfidence,
        });
      }
    }
  }

  const totalFixedCents = lines.filter((l) => l.isFixed).reduce((s, l) => s + l.amountCents, 0);
  const totalVariableCents = lines.filter((l) => !l.isFixed).reduce((s, l) => s + l.amountCents, 0);

  return {
    lines,
    totalFixedCents,
    totalVariableCents,
    totalCents: totalFixedCents + totalVariableCents,
    isLowConfidence,
    monthsOfHistory,
  };
}

// ── Float tracker ────────────────────────────────────────────────────────────

export interface MonthlySettlement {
  monthKey: string;
  /** Amount the non-fronting partner owed (= fronting partner's share reimbursed) */
  reimbursedCents: number;
}

export interface FloatResult {
  /** Current month's shared spend fronted minus reimbursements received */
  outstandingCents: number;
  /** Trailing-max of end-of-month out-of-pocket over the window (rounded up to $50) */
  recommendedReserveCents: number;
  /** How many months were used for the reserve calculation */
  windowMonths: number;
}

export function computeFloat(opts: {
  /** Shared expenses fronted by the fronting partner for the current (open) month */
  currentMonthFrontedCents: number;
  /** Settlement reimbursements received in the current month */
  currentMonthReimbursedCents: number;
  /** Historical monthly end-of-period out-of-pocket amounts (fronted − reimbursed) */
  historicalOutstandingCents: number[];
  /** Override the reserve to this fixed amount; null = auto-compute */
  reserveOverrideCents?: number | null;
  /** How many months to look back for reserve sizing (default 6) */
  windowMonths?: number;
}): FloatResult {
  const {
    currentMonthFrontedCents,
    currentMonthReimbursedCents,
    historicalOutstandingCents,
    reserveOverrideCents = null,
    windowMonths = 6,
  } = opts;

  const outstandingCents = currentMonthFrontedCents - currentMonthReimbursedCents;

  let recommendedReserveCents: number;
  if (reserveOverrideCents !== null) {
    recommendedReserveCents = reserveOverrideCents;
  } else {
    const window = historicalOutstandingCents.slice(-windowMonths);
    const peak = window.length > 0 ? Math.max(...window) : outstandingCents;
    // Round up to nearest $50 (5000 cents)
    recommendedReserveCents = Math.ceil(peak / 5000) * 5000;
  }

  return { outstandingCents, recommendedReserveCents, windowMonths };
}
