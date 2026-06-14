/**
 * Projection engine — spec §5 Layer 2, §7 computeProjection + compareScenarios.
 *
 * Pure, DB-agnostic, integer cents throughout.
 *
 * computeProjection: builds a month-by-month forecast for each user and each fund,
 * up to the requested horizon. Uses income assumptions, allocation rules, a shared
 * spend forecast, one-off events, and starting fund balances.
 *
 * compareScenarios: diffs two projection outputs — fund ETA shifts and per-user
 * discretionary deltas, the trade-off pair always shown side by side.
 */

import { type AllocationRuleInput } from "./statement";

// Re-export so callers have one import
export type { AllocationRuleInput };

function allocCents(rule: AllocationRuleInput, incomeCents: number): number {
  if (rule.fixedCentsOverride !== null) return rule.fixedCentsOverride;
  return Math.floor((rule.percentBps / 10000) * incomeCents);
}

export interface UserProjectionInput {
  userId: string;
  /** Default monthly income assumption (median of recent actuals or user override) */
  defaultIncomeCents: number;
  /** Per-month overrides: monthKey → cents. Only months that differ from default. */
  incomeOverrides: Record<string, number>;
  allocationRules: AllocationRuleInput[];
  /** Float reserve for the fronting partner; 0 for others */
  floatReserveCents: number;
}

export interface FundProjectionInput {
  fundId: string;
  fundName: string;
  scope: "personal" | "couple";
  ownerUserId: string | null;
  targetCents: number | null;
  startingBalanceCents: number;
  /**
   * What to do when the fund target is reached mid-horizon.
   * "stop" = contributions stop (default); "redirect:<fundId>" = future feature stub.
   */
  onCompletion?: "stop";
}

export interface OneOffEvent {
  monthKey: string;
  description: string;
  amountCents: number;
  kind: "shared" | "personal";
  personalUserId?: string; // for kind=personal
  fundId?: string; // if this reduces/adds to a fund
}

export interface ProjectionInput {
  /** "YYYY-MM" of the first projected month */
  startMonthKey: string;
  horizonMonths: number; // 6–24
  users: UserProjectionInput[];
  funds: FundProjectionInput[];
  /** Forecasted shared spend per month (fixed + variable total); from forecastSharedSpend */
  forecastSharedSpendCents: number;
  /** Optional per-month overrides to the shared spend forecast */
  sharedSpendOverrides?: Record<string, number>;
  oneOffEvents?: OneOffEvent[];
}

export interface MonthlyUserSlice {
  userId: string;
  incomeCents: number;
  allocationLines: { fundId: string; fundName: string; plannedCents: number }[];
  totalAllocationCents: number;
  sharedOwedCents: number;
  discretionaryCents: number;
  floatReserveCents: number;
}

export interface MonthlyFundSlice {
  fundId: string;
  contributionCents: number; // total contributions from all users this month
  balanceCents: number; // running balance after contributions
  targetReached: boolean;
}

export interface ProjectedMonth {
  monthKey: string;
  users: MonthlyUserSlice[];
  funds: MonthlyFundSlice[];
}

export interface FundCompletion {
  fundId: string;
  fundName: string;
  completionMonthKey: string | null; // null = not reached within horizon
  finalBalanceCents: number;
}

export interface ProjectionResult {
  months: ProjectedMonth[];
  fundCompletions: FundCompletion[];
}

/** Advance monthKey by N months. E.g. "2026-06" + 1 = "2026-07". */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  return `${yr}-${mo}`;
}

export function computeProjection(input: ProjectionInput): ProjectionResult {
  const { startMonthKey, horizonMonths, users, funds, oneOffEvents = [] } = input;

  // Build a map of one-offs by monthKey
  const oneOffsByMonth = new Map<string, OneOffEvent[]>();
  for (const ev of oneOffEvents) {
    if (!oneOffsByMonth.has(ev.monthKey)) oneOffsByMonth.set(ev.monthKey, []);
    oneOffsByMonth.get(ev.monthKey)!.push(ev);
  }

  // Track fund balances across months
  const fundBalance = new Map<string, number>(
    funds.map((f) => [f.fundId, f.startingBalanceCents]),
  );
  const fundTargetReached = new Map<string, boolean>(funds.map((f) => [f.fundId, false]));

  const months: ProjectedMonth[] = [];
  const fundFirstCompletion = new Map<string, string>();

  for (let i = 0; i < horizonMonths; i++) {
    const monthKey = addMonths(startMonthKey, i);
    const monthOneOffs = oneOffsByMonth.get(monthKey) ?? [];

    // Shared spend for this month
    const sharedSpend =
      input.sharedSpendOverrides?.[monthKey] ?? input.forecastSharedSpendCents;

    // Add one-off shared events
    const oneOffShared = monthOneOffs
      .filter((e) => e.kind === "shared")
      .reduce((s, e) => s + e.amountCents, 0);
    const totalSharedThisMonth = sharedSpend + oneOffShared;

    // Per-user slices
    const userSlices: MonthlyUserSlice[] = [];
    // Collect fund contributions for this month
    const fundContributions = new Map<string, number>();

    // Compute each user's income and proportional shared owed
    const incomeByUser = new Map<string, number>();
    for (const u of users) {
      incomeByUser.set(u.userId, u.incomeOverrides[monthKey] ?? u.defaultIncomeCents);
    }
    const combinedIncome = [...incomeByUser.values()].reduce((a, b) => a + b, 0);

    for (const u of users) {
      const incomeCents = incomeByUser.get(u.userId) ?? 0;
      // Proportional share of shared spend (floor; rounding handled globally for 2 users)
      const sharedOwedCents =
        combinedIncome > 0
          ? Math.floor((incomeCents / combinedIncome) * totalSharedThisMonth)
          : 0;

      // Allocation lines (only for active rules on funds not yet completed)
      const allocationLines = u.allocationRules
        .filter((r) => !(funds.find((f) => f.fundId === r.fundId)?.onCompletion === "stop" && fundTargetReached.get(r.fundId)))
        .map((r) => ({
          fundId: r.fundId,
          fundName: r.fundName,
          plannedCents: allocCents(r, incomeCents),
        }));

      const totalAllocationCents = allocationLines.reduce((s, l) => s + l.plannedCents, 0);

      // Personal one-offs reduce discretionary directly
      const personalOneOff = monthOneOffs
        .filter((e) => e.kind === "personal" && e.personalUserId === u.userId)
        .reduce((s, e) => s + e.amountCents, 0);

      const discretionaryCents =
        incomeCents - totalAllocationCents - sharedOwedCents - personalOneOff;

      // Accumulate fund contributions
      for (const line of allocationLines) {
        fundContributions.set(
          line.fundId,
          (fundContributions.get(line.fundId) ?? 0) + line.plannedCents,
        );
      }

      userSlices.push({
        userId: u.userId,
        incomeCents,
        allocationLines,
        totalAllocationCents,
        sharedOwedCents,
        discretionaryCents,
        floatReserveCents: u.floatReserveCents,
      });
    }

    // Update fund balances and build fund slices
    const fundSlices: MonthlyFundSlice[] = funds.map((f) => {
      const contrib = fundContributions.get(f.fundId) ?? 0;
      const prevBalance = fundBalance.get(f.fundId) ?? 0;
      let newBalance = prevBalance + contrib;

      let targetReached = fundTargetReached.get(f.fundId) ?? false;
      if (!targetReached && f.targetCents !== null && newBalance >= f.targetCents) {
        newBalance = f.targetCents; // cap at target
        targetReached = true;
        fundTargetReached.set(f.fundId, true);
        if (!fundFirstCompletion.has(f.fundId)) {
          fundFirstCompletion.set(f.fundId, monthKey);
        }
      }

      fundBalance.set(f.fundId, newBalance);
      return {
        fundId: f.fundId,
        contributionCents: contrib,
        balanceCents: newBalance,
        targetReached,
      };
    });

    months.push({ monthKey, users: userSlices, funds: fundSlices });
  }

  const fundCompletions: FundCompletion[] = funds.map((f) => ({
    fundId: f.fundId,
    fundName: f.fundName,
    completionMonthKey: fundFirstCompletion.get(f.fundId) ?? null,
    finalBalanceCents: fundBalance.get(f.fundId) ?? f.startingBalanceCents,
  }));

  return { months, fundCompletions };
}

// ── Scenario comparison ──────────────────────────────────────────────────────

export interface FundEtaDelta {
  fundId: string;
  fundName: string;
  baselineCompletionMonthKey: string | null;
  scenarioCompletionMonthKey: string | null;
  /** positive = sooner, negative = later; null if either is null */
  monthsDelta: number | null;
}

export interface UserDiscretionaryDelta {
  userId: string;
  /** Per-month discretionary deltas (scenario − baseline) */
  monthlyDeltas: { monthKey: string; deltaCents: number }[];
  /** Average monthly delta across the horizon */
  avgMonthlyDeltaCents: number;
}

export interface ScenarioComparisonResult {
  fundEtaDeltas: FundEtaDelta[];
  userDiscretionaryDeltas: UserDiscretionaryDelta[];
}

function monthsBetween(earlier: string, later: string): number {
  const [ey, em] = earlier.split("-").map(Number);
  const [ly, lm] = later.split("-").map(Number);
  return (ly - ey) * 12 + (lm - em);
}

export function compareScenarios(
  baseline: ProjectionResult,
  scenario: ProjectionResult,
): ScenarioComparisonResult {
  // Fund ETA deltas
  const scenarioByFund = new Map(scenario.fundCompletions.map((f) => [f.fundId, f]));
  const fundEtaDeltas: FundEtaDelta[] = baseline.fundCompletions.map((b) => {
    const s = scenarioByFund.get(b.fundId);
    let monthsDelta: number | null = null;
    if (b.completionMonthKey && s?.completionMonthKey) {
      // positive = scenario completes sooner (earlier date = better)
      monthsDelta = monthsBetween(s.completionMonthKey, b.completionMonthKey);
    }
    return {
      fundId: b.fundId,
      fundName: b.fundName,
      baselineCompletionMonthKey: b.completionMonthKey,
      scenarioCompletionMonthKey: s?.completionMonthKey ?? null,
      monthsDelta,
    };
  });

  // Per-user discretionary deltas
  const scenarioMonthsByKey = new Map(scenario.months.map((m) => [m.monthKey, m]));
  const allUserIds = new Set(baseline.months.flatMap((m) => m.users.map((u) => u.userId)));

  const userDiscretionaryDeltas: UserDiscretionaryDelta[] = [...allUserIds].map((userId) => {
    const monthlyDeltas = baseline.months.map((bMonth) => {
      const sMonth = scenarioMonthsByKey.get(bMonth.monthKey);
      const bUser = bMonth.users.find((u) => u.userId === userId);
      const sUser = sMonth?.users.find((u) => u.userId === userId);
      const delta = (sUser?.discretionaryCents ?? 0) - (bUser?.discretionaryCents ?? 0);
      return { monthKey: bMonth.monthKey, deltaCents: delta };
    });
    const avgMonthlyDeltaCents =
      monthlyDeltas.length > 0
        ? Math.round(monthlyDeltas.reduce((s, d) => s + d.deltaCents, 0) / monthlyDeltas.length)
        : 0;
    return { userId, monthlyDeltas, avgMonthlyDeltaCents };
  });

  return { fundEtaDeltas, userDiscretionaryDeltas };
}
