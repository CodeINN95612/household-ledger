import "server-only";
import { prisma } from "./prisma";
import type { SafeUser } from "./auth";
import { computeSettlement, type ExpenseType } from "./settlement";
import { currentMonthKey } from "./month";
import { computeStatement, type StatementResult, type AllocationRuleInput } from "./statement";
import { computeFloat, type FloatResult, forecastSharedSpend } from "./forecast";
import { buildColorMap, type PersonColor } from "./person";
import { computeInstallmentCents } from "./money";
import {
  computeProjection,
  addMonths,
  type ProjectionResult,
  type FundProjectionInput,
  type ProjectionInput,
  type OneOffEvent,
} from "./projection";
import {
  computeHealthMetrics,
  type HealthMetrics,
  type FundBalanceEntry as HealthFundBalanceEntry,
} from "./health";

/**
 * Server-side data layer. Every read takes the *requesting* user and applies the
 * income-privacy rule (spec §4) here — the raw amount of another user's private
 * income is never returned to the caller, so it can never reach the client.
 */

export interface MemberInfo {
  id: string;
  displayName: string;
}

export interface ExpenseView {
  id: string;
  date: string; // ISO date
  description: string;
  amountCents: number;
  type: ExpenseType;
  paidByUserId: string;
  paidByName: string;
  category: string | null;
  isRecurringFixed: boolean | null;
  /** Set when this row represents a financed installment, not a regular expense. */
  financed: {
    financedExpenseId: string;
    installmentNum: number;
    totalInstallments: number;
  } | null;
}

export interface IncomeView {
  userId: string;
  displayName: string;
  entered: boolean;
  isPrivate: boolean;
  /** null when hidden from the requesting user (another user's private income). */
  amountCents: number | null;
  /** true when this row is the requesting user's own income. */
  isSelf: boolean;
}

export interface MonthData {
  monthKey: string;
  members: MemberInfo[];
  expenses: ExpenseView[];
  incomes: IncomeView[];
}

/** Which installment number (1-based) falls in monthKey for a plan starting at startMonthKey. */
function installmentNum(startMonthKey: string, monthKey: string): number {
  const [sy, sm] = startMonthKey.split("-").map(Number);
  const [cy, cm] = monthKey.split("-").map(Number);
  return (cy - sy) * 12 + (cm - sm) + 1;
}

/** Build virtual ExpenseView rows from financed expenses active in a given monthKey. */
function buildFinancedRows(
  financedExpenses: Array<{
    id: string;
    description: string;
    totalCents: number;
    installments: number;
    annualRateBps: number;
    startMonthKey: string;
    type: string;
    paidByUserId: string;
    paidByUser: { displayName: string };
    category: string | null;
    cancelledAt: Date | null;
  }>,
  monthKey: string,
): ExpenseView[] {
  const rows: ExpenseView[] = [];
  for (const f of financedExpenses) {
    const num = installmentNum(f.startMonthKey, monthKey);
    if (num < 1 || num > f.installments) continue;
    // If cancelled, stop showing from the cancellation month onward
    if (f.cancelledAt) {
      const cancelMk = f.cancelledAt.toISOString().slice(0, 7);
      if (monthKey >= cancelMk) continue;
    }
    rows.push({
      id: f.id,
      date: `${monthKey}-01T00:00:00.000Z`,
      description: f.description,
      amountCents: computeInstallmentCents(f.totalCents, f.installments, f.annualRateBps),
      type: f.type as ExpenseType,
      paidByUserId: f.paidByUserId,
      paidByName: f.paidByUser.displayName,
      category: f.category,
      isRecurringFixed: true,
      financed: {
        financedExpenseId: f.id,
        installmentNum: num,
        totalInstallments: f.installments,
      },
    });
  }
  return rows;
}

/** The two (v1) members, ordered deterministically by id. */
async function getMembers(): Promise<MemberInfo[]> {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: { id: true, displayName: true },
  });
  return users;
}

export async function getMonthData(
  requestingUser: SafeUser,
  monthKey: string,
): Promise<MonthData> {
  const [members, expenses, incomes, financedExpenses] = await Promise.all([
    getMembers(),
    prisma.expense.findMany({
      where: { monthKey },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { paidBy: { select: { displayName: true } } },
    }),
    prisma.income.findMany({ where: { monthKey } }),
    prisma.financedExpense.findMany({
      where: { startMonthKey: { lte: monthKey } },
      include: { paidByUser: { select: { displayName: true } } },
    }),
  ]);

  const incomeByUser = new Map(incomes.map((i) => [i.userId, i]));

  const incomeViews: IncomeView[] = members.map((m) => {
    const income = incomeByUser.get(m.id);
    const isSelf = m.id === requestingUser.id;
    if (!income) {
      return {
        userId: m.id,
        displayName: m.displayName,
        entered: false,
        isPrivate: false,
        amountCents: null,
        isSelf,
      };
    }
    // Privacy: hide the raw amount only for *another* user's private income.
    const hidden = income.isPrivate && !isSelf;
    return {
      userId: m.id,
      displayName: m.displayName,
      entered: true,
      isPrivate: income.isPrivate,
      amountCents: hidden ? null : income.amountCents,
      isSelf,
    };
  });

  const regularExpenses: ExpenseView[] = expenses.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    description: e.description,
    amountCents: e.amountCents,
    type: e.type as ExpenseType,
    paidByUserId: e.paidByUserId,
    paidByName: e.paidBy.displayName,
    category: e.category,
    isRecurringFixed: e.isRecurringFixed,
    financed: null,
  }));

  return {
    monthKey,
    members,
    expenses: [...regularExpenses, ...buildFinancedRows(financedExpenses, monthKey)],
    incomes: incomeViews,
  };
}

/** Returns anomaly data when variable shared spend this month is >30% above the prior 6-month average. */
export async function getSpendingAnomalyData(
  monthKey: string,
): Promise<{ currentVariableCents: number; avgPrior6VariableCents: number } | null> {
  const startOfHistory = addMonths(monthKey, -7);
  const expenses = await prisma.expense.findMany({
    where: {
      type: "shared",
      isRecurringFixed: { not: true }, // variable = not explicitly marked fixed
      monthKey: { gte: startOfHistory },
    },
    select: { monthKey: true, amountCents: true },
  });

  const byMonth = new Map<string, number>();
  for (const e of expenses) {
    byMonth.set(e.monthKey, (byMonth.get(e.monthKey) ?? 0) + e.amountCents);
  }

  const currentCents = byMonth.get(monthKey) ?? 0;
  const priorMonths = [...byMonth.entries()]
    .filter(([mk]) => mk < monthKey)
    .sort((a, b) => (b[0] < a[0] ? 1 : -1))
    .slice(0, 6);

  if (priorMonths.length < 3) return null; // not enough history

  const avgPrior6 = Math.round(
    priorMonths.reduce((s, [, v]) => s + v, 0) / priorMonths.length,
  );

  if (avgPrior6 <= 0 || currentCents <= avgPrior6 * 1.3) return null;

  return { currentVariableCents: currentCents, avgPrior6VariableCents: avgPrior6 };
}

export interface SettlementMemberView {
  userId: string;
  displayName: string;
  isPrivateIncome: boolean;
  /** null when hidden from the requesting user. */
  incomeCents: number | null;
  ratio: number;
  owedCents: number;
  paidCents: number;
  balanceCents: number;
}

export type SettlementView =
  | { status: "pending"; totalSharedCents: number; missing: MemberInfo[] }
  | { status: "zero-income"; totalSharedCents: number }
  | {
      status: "ready";
      totalSharedCents: number;
      members: SettlementMemberView[];
      transfers: { fromName: string; toName: string; amountCents: number }[];
    };

export async function getSettlementView(
  requestingUser: SafeUser,
  monthKey: string,
): Promise<SettlementView> {
  const [members, expenses, incomes, financedExpenses] = await Promise.all([
    getMembers(),
    prisma.expense.findMany({ where: { monthKey } }),
    prisma.income.findMany({ where: { monthKey } }),
    prisma.financedExpense.findMany({
      where: { startMonthKey: { lte: monthKey } },
      include: { paidByUser: { select: { displayName: true } } },
    }),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.displayName]));
  const incomeByUser = new Map(incomes.map((i) => [i.userId, i]));

  const financedRows = buildFinancedRows(financedExpenses, monthKey);

  // Compute on the REAL amounts, server-side.
  const result = computeSettlement({
    memberIds: members.map((m) => m.id),
    incomes: incomes.map((i) => ({ userId: i.userId, amountCents: i.amountCents })),
    expenses: [
      ...expenses.map((e) => ({
        paidByUserId: e.paidByUserId,
        amountCents: e.amountCents,
        type: e.type as ExpenseType,
      })),
      ...financedRows.map((f) => ({
        paidByUserId: f.paidByUserId,
        amountCents: f.amountCents,
        type: f.type,
      })),
    ],
  });

  if (result.status === "pending") {
    return {
      status: "pending",
      totalSharedCents: result.totalSharedCents,
      missing: result.missingIncomeUserIds.map((id) => ({
        id,
        displayName: nameById.get(id) ?? "Unknown",
      })),
    };
  }
  if (result.status === "zero-income") {
    return { status: "zero-income", totalSharedCents: result.totalSharedCents };
  }

  return {
    status: "ready",
    totalSharedCents: result.totalSharedCents,
    members: result.members.map((m) => {
      const income = incomeByUser.get(m.userId);
      const isPrivate = income?.isPrivate ?? false;
      const hidden = isPrivate && m.userId !== requestingUser.id;
      return {
        userId: m.userId,
        displayName: nameById.get(m.userId) ?? "Unknown",
        isPrivateIncome: isPrivate,
        // Strip the raw amount for another user's private income; ratio/owed stay.
        incomeCents: hidden ? null : m.incomeCents,
        ratio: m.ratio,
        owedCents: m.owedCents,
        paidCents: m.paidCents,
        balanceCents: m.balanceCents,
      };
    }),
    transfers: result.transfers.map((t) => ({
      fromName: nameById.get(t.fromUserId) ?? "Unknown",
      toName: nameById.get(t.toUserId) ?? "Unknown",
      amountCents: t.amountCents,
    })),
  };
}

export interface MonthSummary {
  monthKey: string;
  totalSharedCents: number;
  expenseCount: number;
}

/**
 * History: every month that has any expense or income, newest first.
 *
 * Takes the requesting user for signature consistency with the rest of the data
 * layer (every read is scoped to a user), though month summaries expose no
 * private data so nothing needs filtering here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listMonths(_requestingUser: SafeUser): Promise<MonthSummary[]> {
  const [sharedSums, expenseCounts, incomeMonths] = await Promise.all([
    prisma.expense.groupBy({
      by: ["monthKey"],
      where: { type: "shared" },
      _sum: { amountCents: true },
    }),
    prisma.expense.groupBy({ by: ["monthKey"], _count: { _all: true } }),
    prisma.income.groupBy({ by: ["monthKey"] }),
  ]);

  const sharedByKey = new Map(sharedSums.map((m) => [m.monthKey, m._sum.amountCents ?? 0]));
  const countByKey = new Map(expenseCounts.map((m) => [m.monthKey, m._count._all]));

  // Always include the current month so it's reachable even before any entry.
  const keys = new Set<string>([
    ...expenseCounts.map((m) => m.monthKey),
    ...incomeMonths.map((m) => m.monthKey),
    currentMonthKey(),
  ]);

  return [...keys]
    .sort((a, b) => (a < b ? 1 : -1)) // newest first
    .map((monthKey) => ({
      monthKey,
      totalSharedCents: sharedByKey.get(monthKey) ?? 0,
      expenseCount: countByKey.get(monthKey) ?? 0,
    }));
}

// ── v2: Statement ─────────────────────────────────────────────────────────────

export interface StatementPageData {
  monthKey: string;
  displayName: string;
  personColor: PersonColor;
  statement: StatementResult;
  /** null when this user is not the fronting partner */
  floatData: FloatResult | null;
}

export async function getStatementData(
  requestingUser: SafeUser,
  monthKey: string,
): Promise<StatementPageData> {
  const [members, income, rules, contributions, expenses, settings] = await Promise.all([
    getMembers(),
    prisma.income.findUnique({ where: { userId_monthKey: { userId: requestingUser.id, monthKey } } }),
    prisma.allocationRule.findMany({
      where: { userId: requestingUser.id, active: true },
      include: { fund: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fundEntry.findMany({
      where: { userId: requestingUser.id, monthKey, kind: "contribution" },
    }),
    // Need expenses for forecast + float
    prisma.expense.findMany({ where: { monthKey } }),
    prisma.householdSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const colorByUser = buildColorMap(members.map((m) => m.id));
  const personColor = colorByUser.get(requestingUser.id) ?? "a";

  const incomeCents = income?.amountCents ?? 0;

  // Determine shared owed from settlement (or estimate from forecast)
  const allIncomes = await prisma.income.findMany({ where: { monthKey } });
  const memberIds = members.map((m) => m.id);
  const settlement = computeSettlement({
    memberIds,
    incomes: allIncomes.map((i) => ({ userId: i.userId, amountCents: i.amountCents })),
    expenses: expenses.map((e) => ({
      paidByUserId: e.paidByUserId,
      amountCents: e.amountCents,
      type: e.type as ExpenseType,
    })),
  });

  let sharedOwedCents = 0;
  let sharedIsEstimated = false;

  if (settlement.status === "ready") {
    const memberResult = settlement.members.find((m) => m.userId === requestingUser.id);
    sharedOwedCents = memberResult?.owedCents ?? 0;
  } else if (settlement.status === "pending") {
    // Estimate from expense history (forecastSharedSpend)
    const historicExpenses = await prisma.expense.findMany({
      where: { monthKey: { lt: monthKey } },
      select: { monthKey: true, description: true, amountCents: true, type: true, isRecurringFixed: true },
      orderBy: { monthKey: "desc" },
      take: 500,
    });
    const forecast = forecastSharedSpend(
      historicExpenses.map((e) => ({
        monthKey: e.monthKey,
        description: e.description,
        amountCents: e.amountCents,
        type: e.type as "shared" | "personal",
        isRecurringFixed: e.isRecurringFixed,
      })),
    );
    // Use the requesting user's income ratio against forecast total
    const totalIncomeSoFar = allIncomes.reduce((s, i) => s + i.amountCents, 0) + incomeCents;
    const ratio = totalIncomeSoFar > 0 ? incomeCents / totalIncomeSoFar : 0.5;
    sharedOwedCents = Math.floor(ratio * forecast.totalCents);
    sharedIsEstimated = true;
  }

  const allocationRuleInputs = rules.map((r) => ({
    fundId: r.fundId,
    fundName: r.fund.name,
    percentBps: r.percentBps,
    fixedCentsOverride: r.fixedCentsOverride,
  }));

  const contributionInputs = contributions.map((c) => ({
    fundId: c.fundId,
    amountCents: c.amountCents,
  }));

  // Float: only compute for the fronting partner
  const isFrontingPartner = settings?.frontingUserId === requestingUser.id;
  let floatData: FloatResult | null = null;

  if (isFrontingPartner) {
    const frontedCents = expenses
      .filter((e) => e.type === "shared" && e.paidByUserId === requestingUser.id)
      .reduce((s, e) => s + e.amountCents, 0);

    // Build historical outstanding from past 6 months
    const histStart = addMonths(monthKey, -6);
    const [histExpenses, histIncomes] = await Promise.all([
      prisma.expense.findMany({
        where: { type: "shared", monthKey: { gte: histStart, lt: monthKey } },
        select: { monthKey: true, amountCents: true, paidByUserId: true },
      }),
      prisma.income.findMany({
        where: { monthKey: { gte: histStart, lt: monthKey } },
        select: { monthKey: true, userId: true, amountCents: true },
      }),
    ]);

    const frontedByMonth = new Map<string, number>();
    const totalSharedByMonth = new Map<string, number>();
    for (const e of histExpenses) {
      totalSharedByMonth.set(e.monthKey, (totalSharedByMonth.get(e.monthKey) ?? 0) + e.amountCents);
      if (e.paidByUserId === requestingUser.id) {
        frontedByMonth.set(e.monthKey, (frontedByMonth.get(e.monthKey) ?? 0) + e.amountCents);
      }
    }
    const incomeByMonth = new Map<string, Map<string, number>>();
    for (const inc of histIncomes) {
      if (!incomeByMonth.has(inc.monthKey)) incomeByMonth.set(inc.monthKey, new Map());
      incomeByMonth.get(inc.monthKey)!.set(inc.userId, inc.amountCents);
    }

    const historicalOutstandingCents: number[] = [];
    for (const [mk, fronted] of frontedByMonth.entries()) {
      const monthIncomes = incomeByMonth.get(mk);
      if (!monthIncomes || monthIncomes.size === 0) {
        historicalOutstandingCents.push(fronted);
        continue;
      }
      const totalIncome = [...monthIncomes.values()].reduce((s, v) => s + v, 0);
      const myIncome = monthIncomes.get(requestingUser.id) ?? 0;
      const myRatio = totalIncome > 0 ? myIncome / totalIncome : 0.5;
      const totalShared = totalSharedByMonth.get(mk) ?? 0;
      const reimbursed = totalShared - Math.floor(myRatio * totalShared);
      historicalOutstandingCents.push(Math.max(0, fronted - reimbursed));
    }

    floatData = computeFloat({
      currentMonthFrontedCents: frontedCents,
      currentMonthReimbursedCents: 0,
      historicalOutstandingCents,
      reserveOverrideCents: settings?.floatReserveCentsOverride ?? null,
    });
  }

  const floatReserveCents = floatData?.recommendedReserveCents ?? 0;

  const statement = computeStatement({
    incomeCents,
    allocationRules: allocationRuleInputs,
    sharedOwedCents,
    sharedIsEstimated,
    actualContributions: contributionInputs,
    floatReserveCents,
  });

  return {
    monthKey,
    displayName: requestingUser.displayName,
    personColor,
    statement,
    floatData,
  };
}

// ── v2: Funds ─────────────────────────────────────────────────────────────────

export interface FundView {
  id: string;
  name: string;
  scope: "personal" | "couple";
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  targetCents: number | null;
  targetDate: Date | null;
  isPrivate: boolean;
  isSinking: boolean;
  sinkingNote: string | null;
  currentBalanceCents: number;
  /** The requesting user's allocation rule for this fund, if any. */
  allocationRule: { percentBps: number; fixedCentsOverride: number | null } | null;
}

export interface FundDetailView extends FundView {
  entries: {
    id: string;
    monthKey: string;
    userId: string;
    userName: string;
    amountCents: number;
    kind: "contribution" | "withdrawal" | "adjustment";
    note: string | null;
    createdAt: Date;
  }[];
}

export async function getFunds(requestingUser: SafeUser): Promise<FundView[]> {
  const [funds, allUsers] = await Promise.all([
    prisma.fund.findMany({
      where: { archived: false },
      include: {
        entries: { select: { amountCents: true } },
        allocationRules: {
          where: { userId: requestingUser.id, active: true },
          select: { percentBps: true, fixedCentsOverride: true },
        },
      },
      orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({ select: { id: true, displayName: true } }),
  ]);

  const nameById = new Map(allUsers.map((u) => [u.id, u.displayName]));

  return funds
    .filter((f) => {
      // Hide private personal funds owned by another user
      if (f.scope === "personal" && f.isPrivate && f.ownerUserId !== requestingUser.id)
        return false;
      return true;
    })
    .map((f) => ({
      id: f.id,
      name: f.name,
      scope: f.scope as "personal" | "couple",
      ownerUserId: f.ownerUserId,
      ownerDisplayName: f.ownerUserId ? (nameById.get(f.ownerUserId) ?? null) : null,
      targetCents: f.targetCents,
      targetDate: f.targetDate,
      isPrivate: f.isPrivate,
      isSinking: f.isSinking,
      sinkingNote: f.sinkingNote,
      currentBalanceCents: f.entries.reduce((s, e) => s + e.amountCents, 0),
      allocationRule:
        f.allocationRules.length > 0
          ? {
              percentBps: f.allocationRules[0].percentBps,
              fixedCentsOverride: f.allocationRules[0].fixedCentsOverride,
            }
          : null,
    }));
}

export async function getFundDetail(
  requestingUser: SafeUser,
  fundId: string,
): Promise<FundDetailView | null> {
  const [fund, allUsers] = await Promise.all([
    prisma.fund.findUnique({
      where: { id: fundId },
      include: {
        entries: {
          orderBy: [{ createdAt: "desc" }],
        },
        allocationRules: {
          where: { userId: requestingUser.id, active: true },
          select: { percentBps: true, fixedCentsOverride: true },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, displayName: true } }),
  ]);

  if (!fund) return null;
  // Private personal fund → only visible to owner
  if (fund.scope === "personal" && fund.isPrivate && fund.ownerUserId !== requestingUser.id)
    return null;

  const nameById = new Map(allUsers.map((u) => [u.id, u.displayName]));

  return {
    id: fund.id,
    name: fund.name,
    scope: fund.scope as "personal" | "couple",
    ownerUserId: fund.ownerUserId,
    ownerDisplayName: fund.ownerUserId ? (nameById.get(fund.ownerUserId) ?? null) : null,
    targetCents: fund.targetCents,
    targetDate: fund.targetDate,
    isPrivate: fund.isPrivate,
    isSinking: fund.isSinking,
    sinkingNote: fund.sinkingNote,
    currentBalanceCents: fund.entries.reduce((s, e) => s + e.amountCents, 0),
    allocationRule:
      fund.allocationRules.length > 0
        ? {
            percentBps: fund.allocationRules[0].percentBps,
            fixedCentsOverride: fund.allocationRules[0].fixedCentsOverride,
          }
        : null,
    entries: fund.entries.map((e) => ({
      id: e.id,
      monthKey: e.monthKey,
      userId: e.userId,
      userName: nameById.get(e.userId) ?? "Unknown",
      amountCents: e.amountCents,
      kind: e.kind as "contribution" | "withdrawal" | "adjustment",
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}

export interface SweepFundRow {
  fundId: string;
  fundName: string;
  scope: "personal" | "couple";
  plannedContributionCents: number;
  alreadyContributedCents: number;
}

export async function getSweepData(
  requestingUser: SafeUser,
  monthKey: string,
): Promise<SweepFundRow[]> {
  const [funds, income, contributions] = await Promise.all([
    getFunds(requestingUser),
    prisma.income.findUnique({
      where: { userId_monthKey: { userId: requestingUser.id, monthKey } },
    }),
    prisma.fundEntry.findMany({
      where: { userId: requestingUser.id, monthKey, kind: "contribution" },
    }),
  ]);

  const incomeCents = income?.amountCents ?? 0;
  const contributedByFund = new Map(contributions.map((c) => [c.fundId, c.amountCents]));

  return funds.map((f) => {
    let plannedCents = 0;
    if (f.allocationRule) {
      if (f.allocationRule.fixedCentsOverride !== null) {
        plannedCents = f.allocationRule.fixedCentsOverride;
      } else {
        plannedCents = Math.floor((f.allocationRule.percentBps / 10000) * incomeCents);
      }
    }
    return {
      fundId: f.id,
      fundName: f.name,
      scope: f.scope,
      plannedContributionCents: plannedCents,
      alreadyContributedCents: contributedByFund.get(f.id) ?? 0,
    };
  });
}

// ── v2: Projection ─────────────────────────────────────────────────────────────

export interface ScenarioOverrides {
  incomeByUserId?: Record<string, number>;
  allocationRuleOverrides?: Array<{
    userId: string;
    fundId: string;
    percentBps: number;
    fixedCentsOverride: number | null;
  }>;
  sharedSpendCents?: number;
}

export interface ProjectionUserData {
  userId: string;
  displayName: string;
  defaultIncomeCents: number;
  allocationRules: AllocationRuleInput[];
}

export interface ProjectionScenarioData {
  id: string;
  name: string;
  baseline: boolean;
  overrides: ScenarioOverrides;
}

export interface OneOffEventView {
  id: string;
  monthKey: string;
  description: string;
  amountCents: number;
  kind: "one-off-shared" | "one-off-personal";
}

export interface ProjectionPageData {
  horizonMonths: number;
  startMonthKey: string;
  users: ProjectionUserData[];
  funds: FundView[];
  fundInputs: FundProjectionInput[];
  baselineScenario: ProjectionScenarioData | null;
  otherScenarios: ProjectionScenarioData[];
  forecastSharedSpendCents: number;
  forecastIsLowConfidence: boolean;
  baselineResult: ProjectionResult;
  frontingUserId: string | null;
  oneOffEvents: OneOffEventView[];
}

export async function getProjectionData(
  requestingUser: SafeUser,
  horizonMonths?: number,
): Promise<ProjectionPageData> {
  const startMonthKey = currentMonthKey();

  const [allUsers, funds, allRules, allIncomes, settings, expenses, scenarios, planAssumptions] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, displayName: true } }),
    getFunds(requestingUser),
    prisma.allocationRule.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.income.findMany({ orderBy: { monthKey: "desc" } }),
    prisma.householdSettings.findUnique({ where: { id: "singleton" } }),
    prisma.expense.findMany({
      where: { type: "shared", monthKey: { gte: addMonths(startMonthKey, -12) } },
      select: { monthKey: true, description: true, amountCents: true, isRecurringFixed: true },
    }),
    prisma.scenario.findMany({ orderBy: [{ baseline: "desc" }, { createdAt: "asc" }] }),
    prisma.planAssumption.findMany({
      where: { userId: requestingUser.id, kind: { in: ["one-off-shared", "one-off-personal"] }, monthKey: { not: null } },
      orderBy: { monthKey: "asc" },
    }),
  ]);

  const horizon = horizonMonths ?? settings?.projectionHorizonMonths ?? 12;
  const frontingUserId = settings?.frontingUserId ?? null;

  // Median of last 3 incomes per user
  const incomesByUser = new Map<string, number[]>();
  for (const inc of allIncomes) {
    if (!incomesByUser.has(inc.userId)) incomesByUser.set(inc.userId, []);
    const list = incomesByUser.get(inc.userId)!;
    if (list.length < 3) list.push(inc.amountCents);
  }
  function median3(amounts: number[]): number {
    if (amounts.length === 0) return 0;
    const s = [...amounts].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  const rulesByUser = new Map<string, typeof allRules>();
  for (const r of allRules) {
    if (!rulesByUser.has(r.userId)) rulesByUser.set(r.userId, []);
    rulesByUser.get(r.userId)!.push(r);
  }
  const fundNameById = new Map(funds.map((f) => [f.id, f.name]));

  const users: ProjectionUserData[] = allUsers.map((u) => ({
    userId: u.id,
    displayName: u.displayName,
    defaultIncomeCents: median3(incomesByUser.get(u.id) ?? []),
    allocationRules: (rulesByUser.get(u.id) ?? []).map((r) => ({
      fundId: r.fundId,
      fundName: fundNameById.get(r.fundId) ?? "Unknown",
      percentBps: r.percentBps,
      fixedCentsOverride: r.fixedCentsOverride,
    })),
  }));

  const fundInputs: FundProjectionInput[] = funds.map((f) => ({
    fundId: f.id,
    fundName: f.name,
    scope: f.scope,
    ownerUserId: f.ownerUserId,
    targetCents: f.targetCents,
    startingBalanceCents: f.currentBalanceCents,
    onCompletion: "stop" as const,
  }));

  const histExpenses = expenses.map((e) => ({
    monthKey: e.monthKey,
    description: e.description,
    amountCents: e.amountCents,
    type: "shared" as const,
    isRecurringFixed: e.isRecurringFixed,
  }));
  const forecast = forecastSharedSpend(histExpenses);

  function parseOverrides(json: string): ScenarioOverrides {
    try { return JSON.parse(json) as ScenarioOverrides; } catch { return {}; }
  }

  const baselineScenario = scenarios.find((s) => s.baseline) ?? null;
  const otherScenarios = scenarios.filter((s) => !s.baseline);

  // Auto-compute float reserve from historical data when no override is set
  let autoFloatReserveCents = 0;
  if (frontingUserId && !settings?.floatReserveCentsOverride) {
    const hist = histExpenses.map((e) => ({ amountCents: e.amountCents }));
    const totalMonthlyShared = hist.reduce((s, e) => s + e.amountCents, 0);
    const monthsOfData = new Set(expenses.map((e) => e.monthKey)).size;
    if (monthsOfData > 0) {
      const avgMonthly = totalMonthlyShared / monthsOfData;
      autoFloatReserveCents = Math.ceil((avgMonthly * 0.5) / 5000) * 5000;
    }
  }
  const floatReserveCents = settings?.floatReserveCentsOverride ?? autoFloatReserveCents;

  // Convert PlanAssumptions to OneOffEvents
  const oneOffEventsForProjection: OneOffEvent[] = planAssumptions
    .filter((p): p is typeof p & { monthKey: string } => p.monthKey !== null)
    .map((p) => ({
      monthKey: p.monthKey,
      description: p.note ?? (p.kind === "one-off-shared" ? "Shared one-off" : "Personal one-off"),
      amountCents: p.amountCents,
      kind: p.kind === "one-off-shared" ? "shared" : "personal",
      personalUserId: p.kind === "one-off-personal" ? requestingUser.id : undefined,
    }));

  const projectionInput: ProjectionInput = {
    startMonthKey,
    horizonMonths: horizon,
    users: users.map((u) => ({
      userId: u.userId,
      defaultIncomeCents: u.defaultIncomeCents,
      incomeOverrides: {},
      allocationRules: u.allocationRules,
      floatReserveCents: u.userId === frontingUserId ? floatReserveCents : 0,
    })),
    funds: fundInputs,
    forecastSharedSpendCents: forecast.totalCents,
    oneOffEvents: oneOffEventsForProjection,
  };

  const oneOffEventsView: OneOffEventView[] = planAssumptions
    .filter((p): p is typeof p & { monthKey: string } => p.monthKey !== null)
    .map((p) => ({
      id: p.id,
      monthKey: p.monthKey,
      description: p.note ?? "",
      amountCents: p.amountCents,
      kind: p.kind as "one-off-shared" | "one-off-personal",
    }));

  return {
    horizonMonths: horizon,
    startMonthKey,
    users,
    funds,
    fundInputs,
    baselineScenario: baselineScenario
      ? { id: baselineScenario.id, name: baselineScenario.name, baseline: true, overrides: parseOverrides(baselineScenario.overridesJson) }
      : null,
    otherScenarios: otherScenarios.map((s) => ({
      id: s.id,
      name: s.name,
      baseline: false,
      overrides: parseOverrides(s.overridesJson),
    })),
    forecastSharedSpendCents: forecast.totalCents,
    forecastIsLowConfidence: forecast.isLowConfidence,
    baselineResult: computeProjection(projectionInput),
    frontingUserId,
    oneOffEvents: oneOffEventsView,
  };
}

// ── v2: Health ────────────────────────────────────────────────────────────────

export interface HealthPageData {
  metrics: HealthMetrics;
  users: Array<{ userId: string; displayName: string }>;
  monthKey: string;
}

export async function getHealthPageData(requestingUser: SafeUser): Promise<HealthPageData> {
  const monthKey = currentMonthKey();
  const histStart = addMonths(monthKey, -12);

  const [allUsers, funds, allRules, incomeRecords, fundEntries, expenses, recentIncomes] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, displayName: true } }),
      getFunds(requestingUser),
      prisma.allocationRule.findMany({ where: { active: true } }),
      prisma.income.findMany({ where: { monthKey: { gte: histStart } } }),
      prisma.fundEntry.findMany({
        where: { kind: "contribution", monthKey: { gte: histStart } },
      }),
      prisma.expense.findMany({
        where: { type: "shared", monthKey: { gte: histStart } },
        select: { monthKey: true, amountCents: true },
      }),
      prisma.income.findMany({ orderBy: { monthKey: "desc" } }),
    ]);

  // Group shared spend by month
  const sharedByMonth = new Map<string, number>();
  for (const e of expenses) {
    sharedByMonth.set(e.monthKey, (sharedByMonth.get(e.monthKey) ?? 0) + e.amountCents);
  }
  const sharedSpendHistory = [...sharedByMonth.entries()].map(([mk, totalSharedCents]) => ({
    monthKey: mk,
    totalSharedCents,
  }));

  // Average shared spend over last 6 months for simple projection
  const recentShared = [...sharedByMonth.entries()].sort((a, b) => (b[0] < a[0] ? 1 : -1)).slice(0, 6);
  const avgSharedCents =
    recentShared.length > 0
      ? Math.round(recentShared.reduce((s, [, v]) => s + v, 0) / recentShared.length)
      : 0;

  // Median income per user
  const incomesByUser = new Map<string, number[]>();
  for (const inc of recentIncomes) {
    if (!incomesByUser.has(inc.userId)) incomesByUser.set(inc.userId, []);
    const list = incomesByUser.get(inc.userId)!;
    if (list.length < 3) list.push(inc.amountCents);
  }
  function median3(amounts: number[]): number {
    if (amounts.length === 0) return 0;
    const s = [...amounts].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  // Build projection (24 months) to get fund completion dates
  const rulesByUser = new Map<string, typeof allRules>();
  for (const r of allRules) {
    if (!rulesByUser.has(r.userId)) rulesByUser.set(r.userId, []);
    rulesByUser.get(r.userId)!.push(r);
  }
  const fundNameById = new Map(funds.map((f) => [f.id, f.name]));

  const fundInputs: FundProjectionInput[] = funds.map((f) => ({
    fundId: f.id,
    fundName: f.name,
    scope: f.scope,
    ownerUserId: f.ownerUserId,
    targetCents: f.targetCents,
    startingBalanceCents: f.currentBalanceCents,
    onCompletion: "stop" as const,
  }));

  const projectionInput: ProjectionInput = {
    startMonthKey: monthKey,
    horizonMonths: 24,
    users: allUsers.map((u) => ({
      userId: u.id,
      defaultIncomeCents: median3(incomesByUser.get(u.id) ?? []),
      incomeOverrides: {},
      allocationRules: (rulesByUser.get(u.id) ?? []).map((r) => ({
        fundId: r.fundId,
        fundName: fundNameById.get(r.fundId) ?? "Unknown",
        percentBps: r.percentBps,
        fixedCentsOverride: r.fixedCentsOverride,
      })),
      floatReserveCents: 0,
    })),
    funds: fundInputs,
    forecastSharedSpendCents: avgSharedCents,
  };

  const projectionResult = computeProjection(projectionInput);
  const completionByFund = new Map(
    projectionResult.fundCompletions.map((c) => [c.fundId, c.completionMonthKey]),
  );

  // Per-user planned discretionary from first projected month
  const perUserPlannedDiscretionaryCents: Record<string, number> = {};
  const firstMonth = projectionResult.months[0];
  if (firstMonth) {
    for (const u of firstMonth.users) {
      perUserPlannedDiscretionaryCents[u.userId] = u.discretionaryCents;
    }
  }

  // Emergency fund IDs: funds whose name contains "emergency" (heuristic)
  const emergencyFundIds = funds
    .filter((f) => f.name.toLowerCase().includes("emergency"))
    .map((f) => f.id);

  const healthFunds: HealthFundBalanceEntry[] = funds.map((f) => ({
    fundId: f.id,
    fundName: f.name,
    scope: f.scope,
    ownerUserId: f.ownerUserId,
    isPrivate: f.isPrivate,
    balanceCents: f.currentBalanceCents,
    targetCents: f.targetCents,
    projectedCompletionMonthKey: completionByFund.get(f.id) ?? null,
  }));

  const metrics = computeHealthMetrics({
    currentMonthKey: monthKey,
    incomes: incomeRecords.map((i) => ({
      userId: i.userId,
      monthKey: i.monthKey,
      amountCents: i.amountCents,
    })),
    contributions: fundEntries.map((e) => ({
      userId: e.userId,
      monthKey: e.monthKey,
      fundId: e.fundId,
      amountCents: e.amountCents,
    })),
    funds: healthFunds,
    emergencyFundIds,
    sharedSpendHistory,
    perUserPlannedDiscretionaryCents,
    perUserSelfReport: Object.fromEntries(allUsers.map((u) => [u.id, null])),
    requestingUserId: requestingUser.id,
  });

  return {
    metrics,
    users: allUsers.map((u) => ({ userId: u.id, displayName: u.displayName })),
    monthKey,
  };
}

// ── v2: Reviews (Plan vs Actual) ──────────────────────────────────────────────

export interface AdherenceFundRow {
  fundId: string;
  fundName: string;
  plannedCents: number;
  actualCents: number;
  status: "hit" | "partial" | "missed";
}

/** Adherence for a single month — used on the statement page. */
export async function getAdherenceData(
  requestingUser: SafeUser,
  monthKey: string,
): Promise<AdherenceFundRow[]> {
  const [rules, income, contributions] = await Promise.all([
    prisma.allocationRule.findMany({
      where: { userId: requestingUser.id, active: true },
      include: { fund: { select: { id: true, name: true } } },
    }),
    prisma.income.findUnique({
      where: { userId_monthKey: { userId: requestingUser.id, monthKey } },
    }),
    prisma.fundEntry.findMany({
      where: { userId: requestingUser.id, monthKey, kind: "contribution" },
    }),
  ]);

  const incomeCents = income?.amountCents ?? 0;
  const actualByFund = new Map(contributions.map((c) => [c.fundId, c.amountCents]));

  return rules.map((r) => {
    const plannedCents =
      r.fixedCentsOverride !== null
        ? r.fixedCentsOverride
        : Math.floor((r.percentBps / 10000) * incomeCents);
    const actualCents = actualByFund.get(r.fundId) ?? 0;
    const ratio = plannedCents > 0 ? actualCents / plannedCents : 1;
    const status: "hit" | "partial" | "missed" =
      ratio >= 0.95 ? "hit" : ratio >= 0.5 ? "partial" : "missed";
    return { fundId: r.fundId, fundName: r.fund.name, plannedCents, actualCents, status };
  });
}

function parsePeriodToMonths(period: string): { monthKeys: string[]; label: string; isAnnual: boolean } | null {
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(period);
  if (qMatch) {
    const year = parseInt(qMatch[1], 10);
    const q = parseInt(qMatch[2], 10);
    const startMonth = (q - 1) * 3 + 1;
    const monthKeys = [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, "0")}`);
    return { monthKeys, label: `Q${q} ${year}`, isAnnual: false };
  }
  const aMatch = /^(\d{4})$/.exec(period);
  if (aMatch) {
    const year = parseInt(aMatch[1], 10);
    const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    return { monthKeys, label: String(year), isAnnual: true };
  }
  return null;
}

export interface ReviewSummaryData {
  period: string;
  periodLabel: string;
  isAnnual: boolean;
  monthKeys: string[];
  totalIncomeCents: number;
  totalSavedCents: number;
  savingsRateBps: number | null;
  totalSharedSpendCents: number;
  adherence: AdherenceFundRow[];
  anomalyMonths: Array<{ monthKey: string; variablePct: number }>;
  priorSavingsRateBps: number | null;
}

export async function getReviewSummary(
  requestingUser: SafeUser,
  period: string,
): Promise<ReviewSummaryData | null> {
  const parsed = parsePeriodToMonths(period);
  if (!parsed) return null;
  const { monthKeys, label, isAnnual } = parsed;

  // Prior period keys (same length)
  const priorStart = addMonths(monthKeys[0], -monthKeys.length);
  const priorMonthKeys = Array.from({ length: monthKeys.length }, (_, i) =>
    addMonths(priorStart, i),
  );

  const allKeys = [...monthKeys, ...priorMonthKeys];

  const [incomeRecords, fundEntries, rules, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { userId: requestingUser.id, monthKey: { in: allKeys } },
    }),
    prisma.fundEntry.findMany({
      where: { userId: requestingUser.id, monthKey: { in: allKeys }, kind: "contribution" },
    }),
    prisma.allocationRule.findMany({
      where: { userId: requestingUser.id, active: true },
      include: { fund: { select: { id: true, name: true } } },
    }),
    prisma.expense.findMany({
      where: { type: "shared", monthKey: { in: allKeys } },
      select: { monthKey: true, amountCents: true, isRecurringFixed: true },
    }),
  ]);

  function savingsRate(incs: typeof incomeRecords, conts: typeof fundEntries, keys: string[]): number | null {
    const totalIncome = incs.filter((i) => keys.includes(i.monthKey)).reduce((s, i) => s + i.amountCents, 0);
    if (totalIncome === 0) return null;
    const totalSaved = conts.filter((c) => keys.includes(c.monthKey)).reduce((s, c) => s + c.amountCents, 0);
    return Math.round((totalSaved / totalIncome) * 10000);
  }

  const totalIncomeCents = incomeRecords
    .filter((i) => monthKeys.includes(i.monthKey))
    .reduce((s, i) => s + i.amountCents, 0);
  const totalSavedCents = fundEntries
    .filter((c) => monthKeys.includes(c.monthKey))
    .reduce((s, c) => s + c.amountCents, 0);
  const savingsRateBps = savingsRate(incomeRecords, fundEntries, monthKeys);
  const priorSavingsRateBps = savingsRate(incomeRecords, fundEntries, priorMonthKeys);

  const totalSharedSpendCents = expenses
    .filter((e) => monthKeys.includes(e.monthKey))
    .reduce((s, e) => s + e.amountCents, 0);

  // Adherence: average income for period as base
  const avgIncomeCents = totalIncomeCents > 0 && monthKeys.length > 0
    ? Math.round(totalIncomeCents / monthKeys.length)
    : 0;
  const actualByFund = new Map<string, number>();
  for (const c of fundEntries.filter((c) => monthKeys.includes(c.monthKey))) {
    actualByFund.set(c.fundId, (actualByFund.get(c.fundId) ?? 0) + c.amountCents);
  }
  const adherence: AdherenceFundRow[] = rules.map((r) => {
    const plannedPerMonth =
      r.fixedCentsOverride !== null
        ? r.fixedCentsOverride
        : Math.floor((r.percentBps / 10000) * avgIncomeCents);
    const plannedCents = plannedPerMonth * monthKeys.length;
    const actualCents = actualByFund.get(r.fundId) ?? 0;
    const ratio = plannedCents > 0 ? actualCents / plannedCents : 1;
    const status: "hit" | "partial" | "missed" =
      ratio >= 0.95 ? "hit" : ratio >= 0.5 ? "partial" : "missed";
    return { fundId: r.fundId, fundName: r.fund.name, plannedCents, actualCents, status };
  });

  // Anomaly months: variable spend > 130% of prior-period avg per month
  const priorVariableByMonth = new Map<string, number>();
  for (const e of expenses.filter(
    (e) => priorMonthKeys.includes(e.monthKey) && e.isRecurringFixed !== true,
  )) {
    priorVariableByMonth.set(e.monthKey, (priorVariableByMonth.get(e.monthKey) ?? 0) + e.amountCents);
  }
  const priorVariableAmounts = [...priorVariableByMonth.values()];
  const priorAvgVariable =
    priorVariableAmounts.length > 0
      ? Math.round(priorVariableAmounts.reduce((s, v) => s + v, 0) / priorVariableAmounts.length)
      : 0;

  const anomalyMonths: Array<{ monthKey: string; variablePct: number }> = [];
  const currentVariableByMonth = new Map<string, number>();
  for (const e of expenses.filter(
    (e) => monthKeys.includes(e.monthKey) && e.isRecurringFixed !== true,
  )) {
    currentVariableByMonth.set(e.monthKey, (currentVariableByMonth.get(e.monthKey) ?? 0) + e.amountCents);
  }
  for (const [mk, amount] of currentVariableByMonth.entries()) {
    if (priorAvgVariable > 0 && amount > priorAvgVariable * 1.3) {
      anomalyMonths.push({
        monthKey: mk,
        variablePct: Math.round(((amount - priorAvgVariable) / priorAvgVariable) * 100),
      });
    }
  }

  return {
    period,
    periodLabel: label,
    isAnnual,
    monthKeys,
    totalIncomeCents,
    totalSavedCents,
    savingsRateBps,
    totalSharedSpendCents,
    adherence,
    anomalyMonths: anomalyMonths.sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1)),
    priorSavingsRateBps,
  };
}

/** Returns all review periods (quarters + years) that have data. */
export async function listReviewPeriods(): Promise<string[]> {
  const months = await prisma.income.groupBy({
    by: ["monthKey"],
    orderBy: { monthKey: "desc" },
  });

  const currentMk = currentMonthKey();
  const periods = new Set<string>();

  for (const { monthKey } of months) {
    if (monthKey >= currentMk) continue; // only completed months
    const [y, m] = monthKey.split("-").map(Number);
    const q = Math.ceil(m / 3);
    const quarterKey = `${y}-Q${q}`;
    // Only include quarters that are fully completed
    const quarterEndMonth = `${y}-${String(q * 3).padStart(2, "0")}`;
    if (quarterEndMonth < currentMk) {
      periods.add(quarterKey);
      periods.add(String(y));
    }
  }

  return [...periods].sort((a, b) => (a < b ? 1 : -1)); // newest first
}
