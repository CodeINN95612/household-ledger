/**
 * Health dashboard engine — spec §5 Layer 4, §7 computeHealthMetrics.
 *
 * Pure, DB-agnostic, integer cents throughout.
 * Computes the six glanceable metrics for the health dashboard.
 */

export interface MonthlyIncomeEntry {
  userId: string;
  monthKey: string;
  amountCents: number;
}

export interface MonthlyContributionEntry {
  userId: string;
  monthKey: string;
  fundId: string;
  amountCents: number; // positive = contribution
}

export interface FundBalanceEntry {
  fundId: string;
  fundName: string;
  scope: "personal" | "couple";
  ownerUserId: string | null;
  isPrivate: boolean;
  balanceCents: number;
  targetCents: number | null;
  /** Projected completion monthKey from the projection engine; null = not in horizon */
  projectedCompletionMonthKey: string | null;
}

export interface MonthlySharedSpend {
  monthKey: string;
  totalSharedCents: number;
}

/** Discrete months used in the trailing window (most recent first) */
function trailingMonths(allMonthKeys: string[], n: number): string[] {
  return [...allMonthKeys].sort().reverse().slice(0, n);
}

export interface SavingsRateResult {
  /** combined savings rate this month */
  currentMonthBps: number | null; // basis points; null if income = 0
  trailing3Bps: number | null;
  trailing12Bps: number | null;
  /** per-user rates for the current month */
  perUserCurrentBps: Record<string, number | null>;
}

export interface EmergencyRunwayResult {
  /** decimal months of runway */
  runwayMonths: number | null;
  emergencyFundBalanceCents: number;
  avgMonthlyEssentialCents: number | null;
  /** visual band: "low" < 3 months, "ok" 3–6, "strong" > 6 */
  band: "low" | "ok" | "strong" | "unknown";
}

export interface GoalFundingResult {
  fundId: string;
  fundName: string;
  balanceCents: number;
  targetCents: number | null;
  /** 0.0 – 1.0; null when no target */
  progressRatio: number | null;
  projectedCompletionMonthKey: string | null;
}

export interface SharedBurnTrendResult {
  /** Monthly spend amounts in chronological order (most-recent last) */
  monthlyAmounts: { monthKey: string; amountCents: number }[];
  /** true if last 3 consecutive months are each above the prior 6-month average */
  sustainedCreep: boolean;
  prior6MonthAvgCents: number | null;
}

export interface DiscretionaryComfortResult {
  /** per-user planned discretionary for the current month */
  perUserPlannedDiscretionaryCents: Record<string, number>;
  /** per-user self-report for current month; null = not reported */
  perUserSelfReport: Record<string, "overshot" | "fine" | "under" | null>;
}

export interface HealthMetrics {
  savingsRate: SavingsRateResult;
  emergencyRunway: EmergencyRunwayResult;
  goalFunding: GoalFundingResult[];
  sharedBurnTrend: SharedBurnTrendResult;
  discretionaryComfort: DiscretionaryComfortResult;
}

export function computeHealthMetrics(opts: {
  currentMonthKey: string;
  incomes: MonthlyIncomeEntry[];
  contributions: MonthlyContributionEntry[];
  funds: FundBalanceEntry[];
  /** IDs of funds classified as emergency funds */
  emergencyFundIds: string[];
  sharedSpendHistory: MonthlySharedSpend[];
  perUserPlannedDiscretionaryCents: Record<string, number>;
  perUserSelfReport: Record<string, "overshot" | "fine" | "under" | null>;
  /** requesting user — for privacy filtering */
  requestingUserId: string;
}): HealthMetrics {
  const {
    currentMonthKey,
    incomes,
    contributions,
    funds,
    emergencyFundIds,
    sharedSpendHistory,
    perUserPlannedDiscretionaryCents,
    perUserSelfReport,
    requestingUserId,
  } = opts;

  const allMonthKeys = [...new Set(incomes.map((i) => i.monthKey))].sort();

  // ── 1 & 2: Savings rate ─────────────────────────────────────────────────
  function savingsRateForMonths(monthKeys: string[]): number | null {
    const totalIncome = incomes
      .filter((i) => monthKeys.includes(i.monthKey))
      .reduce((s, i) => s + i.amountCents, 0);
    if (totalIncome === 0) return null;
    const totalContributions = contributions
      .filter((c) => monthKeys.includes(c.monthKey))
      .reduce((s, c) => s + c.amountCents, 0);
    return Math.round((totalContributions / totalIncome) * 10000); // basis points
  }

  function perUserRateForMonth(monthKey: string): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    const userIds = [...new Set(incomes.map((i) => i.userId))];
    for (const uid of userIds) {
      const income = incomes.find((i) => i.monthKey === monthKey && i.userId === uid)?.amountCents ?? 0;
      if (income === 0) { result[uid] = null; continue; }
      const saved = contributions
        .filter((c) => c.monthKey === monthKey && c.userId === uid)
        .reduce((s, c) => s + c.amountCents, 0);
      result[uid] = Math.round((saved / income) * 10000);
    }
    return result;
  }

  const trailing3 = trailingMonths(allMonthKeys, 3);
  const trailing12 = trailingMonths(allMonthKeys, 12);

  const savingsRate: SavingsRateResult = {
    currentMonthBps: savingsRateForMonths([currentMonthKey]),
    trailing3Bps: trailing3.length > 0 ? savingsRateForMonths(trailing3) : null,
    trailing12Bps: trailing12.length > 0 ? savingsRateForMonths(trailing12) : null,
    perUserCurrentBps: perUserRateForMonth(currentMonthKey),
  };

  // ── 3: Emergency runway ─────────────────────────────────────────────────
  const emergencyBalance = funds
    .filter((f) => emergencyFundIds.includes(f.fundId))
    .reduce((s, f) => s + f.balanceCents, 0);

  const last6Shared = trailingMonths(sharedSpendHistory.map((s) => s.monthKey), 6);
  const avgMonthlyEssentialCents =
    last6Shared.length > 0
      ? Math.round(
          sharedSpendHistory
            .filter((s) => last6Shared.includes(s.monthKey))
            .reduce((sum, s) => sum + s.totalSharedCents, 0) / last6Shared.length,
        )
      : null;

  const runwayMonths =
    avgMonthlyEssentialCents && avgMonthlyEssentialCents > 0
      ? emergencyBalance / avgMonthlyEssentialCents
      : null;

  const band: EmergencyRunwayResult["band"] =
    runwayMonths === null
      ? "unknown"
      : runwayMonths < 3
        ? "low"
        : runwayMonths <= 6
          ? "ok"
          : "strong";

  const emergencyRunway: EmergencyRunwayResult = {
    runwayMonths,
    emergencyFundBalanceCents: emergencyBalance,
    avgMonthlyEssentialCents,
    band,
  };

  // ── 4: Goal funding ─────────────────────────────────────────────────────
  const goalFunding: GoalFundingResult[] = funds
    .filter((f) => {
      // Couple funds visible to all; personal private funds visible to owner only
      if (f.scope === "couple") return true;
      if (f.isPrivate && f.ownerUserId !== requestingUserId) return false;
      return true;
    })
    .map((f) => ({
      fundId: f.fundId,
      fundName: f.fundName,
      balanceCents: f.balanceCents,
      targetCents: f.targetCents,
      progressRatio:
        f.targetCents !== null && f.targetCents > 0
          ? Math.min(f.balanceCents / f.targetCents, 1)
          : null,
      projectedCompletionMonthKey: f.projectedCompletionMonthKey,
    }));

  // ── 5: Shared burn trend ─────────────────────────────────────────────────
  const sortedSpend = [...sharedSpendHistory].sort((a, b) =>
    a.monthKey < b.monthKey ? -1 : 1,
  );
  const prior6 = sortedSpend.slice(-9, -3); // 6 months before the last 3
  const last3 = sortedSpend.slice(-3);
  const prior6Avg =
    prior6.length > 0
      ? Math.round(prior6.reduce((s, m) => s + m.totalSharedCents, 0) / prior6.length)
      : null;
  const sustainedCreep =
    prior6Avg !== null && last3.length === 3
      ? last3.every((m) => m.totalSharedCents > prior6Avg)
      : false;

  const sharedBurnTrend: SharedBurnTrendResult = {
    monthlyAmounts: sortedSpend.map((s) => ({
      monthKey: s.monthKey,
      amountCents: s.totalSharedCents,
    })),
    sustainedCreep,
    prior6MonthAvgCents: prior6Avg,
  };

  // ── 6: Discretionary comfort ─────────────────────────────────────────────
  // Only show requesting user's own discretionary (privacy)
  const ownDiscretionary: Record<string, number> = {};
  if (perUserPlannedDiscretionaryCents[requestingUserId] !== undefined) {
    ownDiscretionary[requestingUserId] = perUserPlannedDiscretionaryCents[requestingUserId];
  }
  const ownSelfReport: Record<string, "overshot" | "fine" | "under" | null> = {};
  if (perUserSelfReport[requestingUserId] !== undefined) {
    ownSelfReport[requestingUserId] = perUserSelfReport[requestingUserId];
  }

  const discretionaryComfort: DiscretionaryComfortResult = {
    perUserPlannedDiscretionaryCents: ownDiscretionary,
    perUserSelfReport: ownSelfReport,
  };

  return { savingsRate, emergencyRunway, goalFunding, sharedBurnTrend, discretionaryComfort };
}
