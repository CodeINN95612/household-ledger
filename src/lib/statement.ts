/**
 * Statement engine — Layer 1 of v2 (spec §5 Layer 1, §7 computeStatement).
 *
 * Pure, DB-agnostic. Takes integer cents in, returns integer cents out.
 * Rounding: allocation amounts floored with any leftover cent assigned to
 * the first rule (deterministic). Display rounding only at the UI layer.
 */

export interface AllocationRuleInput {
  fundId: string;
  fundName: string;
  percentBps: number; // basis points; 1000 = 10%
  fixedCentsOverride: number | null; // if set, use instead of percent
}

export interface ContributionInput {
  fundId: string;
  amountCents: number; // actual contribution recorded this month
}

export interface AllocationLine {
  fundId: string;
  fundName: string;
  plannedCents: number;
  actualCents: number | null; // null = not yet recorded
}

export interface StatementResult {
  incomeCents: number;
  allocationLines: AllocationLine[];
  totalPlannedAllocationCents: number;
  totalActualAllocationCents: number | null; // null if any contribution missing
  sharedOwedCents: number; // from settlement, or estimated
  sharedIsEstimated: boolean; // true when income missing → estimated from forecast
  discretionaryPlannedCents: number; // income − planned allocations − shared owed
  discretionaryActualCents: number | null; // income − actual allocations − shared owed; null if contributions missing
  floatReserveCents: number; // 0 for non-fronting partner
  /** true if income is 0 (valid, allocations scale to 0) */
  isZeroIncome: boolean;
  /** true when planned allocations sum ≥ income + shared owed (negative discretionary) */
  isOverAllocated: boolean;
}

/**
 * Compute the planned allocation for a rule given income.
 * Returns integer cents; uses fixedCentsOverride when present.
 */
function plannedForRule(rule: AllocationRuleInput, incomeCents: number): number {
  if (rule.fixedCentsOverride !== null) return rule.fixedCentsOverride;
  // percentBps / 10000 * incomeCents, floored
  return Math.floor((rule.percentBps / 10000) * incomeCents);
}

export function computeStatement(opts: {
  incomeCents: number;
  allocationRules: AllocationRuleInput[];
  /** owedCents from v1 settlement, or an estimated value */
  sharedOwedCents: number;
  sharedIsEstimated?: boolean;
  /** actual contributions recorded this month, keyed by fundId */
  actualContributions?: ContributionInput[];
  /** float reserve for the fronting partner; 0 / omit for others */
  floatReserveCents?: number;
}): StatementResult {
  const {
    incomeCents,
    allocationRules,
    sharedOwedCents,
    sharedIsEstimated = false,
    actualContributions = [],
    floatReserveCents = 0,
  } = opts;

  const contributionMap = new Map(actualContributions.map((c) => [c.fundId, c.amountCents]));

  const allocationLines: AllocationLine[] = allocationRules.map((rule) => ({
    fundId: rule.fundId,
    fundName: rule.fundName,
    plannedCents: plannedForRule(rule, incomeCents),
    actualCents: contributionMap.has(rule.fundId) ? (contributionMap.get(rule.fundId) ?? 0) : null,
  }));

  const totalPlannedAllocationCents = allocationLines.reduce((s, l) => s + l.plannedCents, 0);

  const allHaveActuals = allocationLines.every((l) => l.actualCents !== null);
  const totalActualAllocationCents = allHaveActuals
    ? allocationLines.reduce((s, l) => s + (l.actualCents ?? 0), 0)
    : null;

  const discretionaryPlannedCents = incomeCents - totalPlannedAllocationCents - sharedOwedCents;
  const discretionaryActualCents =
    totalActualAllocationCents !== null
      ? incomeCents - totalActualAllocationCents - sharedOwedCents
      : null;

  return {
    incomeCents,
    allocationLines,
    totalPlannedAllocationCents,
    totalActualAllocationCents,
    sharedOwedCents,
    sharedIsEstimated,
    discretionaryPlannedCents,
    discretionaryActualCents,
    floatReserveCents,
    isZeroIncome: incomeCents === 0,
    isOverAllocated: discretionaryPlannedCents < 0,
  };
}
