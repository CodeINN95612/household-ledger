import "server-only";
import { prisma } from "./prisma";
import type { SafeUser } from "./auth";
import { computeSettlement, type ExpenseType } from "./settlement";
import { currentMonthKey } from "./month";

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
  const [members, expenses, incomes] = await Promise.all([
    getMembers(),
    prisma.expense.findMany({
      where: { monthKey },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { paidBy: { select: { displayName: true } } },
    }),
    prisma.income.findMany({ where: { monthKey } }),
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

  return {
    monthKey,
    members,
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      description: e.description,
      amountCents: e.amountCents,
      type: e.type as ExpenseType,
      paidByUserId: e.paidByUserId,
      paidByName: e.paidBy.displayName,
    })),
    incomes: incomeViews,
  };
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
  const [members, expenses, incomes] = await Promise.all([
    getMembers(),
    prisma.expense.findMany({ where: { monthKey } }),
    prisma.income.findMany({ where: { monthKey } }),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.displayName]));
  const incomeByUser = new Map(incomes.map((i) => [i.userId, i]));

  // Compute on the REAL amounts, server-side.
  const result = computeSettlement({
    memberIds: members.map((m) => m.id),
    incomes: incomes.map((i) => ({ userId: i.userId, amountCents: i.amountCents })),
    expenses: expenses.map((e) => ({
      paidByUserId: e.paidByUserId,
      amountCents: e.amountCents,
      type: e.type as ExpenseType,
    })),
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
