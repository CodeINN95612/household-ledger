/**
 * Settlement engine — the heart of the app (see spec §2).
 *
 * Pure, stateless, and DB-agnostic: it takes plain numbers in integer **cents**
 * and returns a fully-computed settlement. Because it is order-independent, a
 * partner fronting a shared expense simply raises their `paid`, which lowers what
 * they owe at settlement — nothing ever needs manual recalculation.
 *
 * Money is always integer cents. Rounding happens only when splitting the shared
 * total into each member's "owed" share, using the largest-remainder method so the
 * rounded shares always sum back to the exact total (spec §8).
 */

export type ExpenseType = "shared" | "personal";

export interface SettlementExpense {
  paidByUserId: string;
  amountCents: number;
  type: ExpenseType;
}

export interface IncomeEntry {
  userId: string;
  amountCents: number;
}

export interface SettlementInput {
  /** All participants for the period (the two users in v1). */
  memberIds: string[];
  /** Incomes that have actually been entered for the period. */
  incomes: IncomeEntry[];
  expenses: SettlementExpense[];
}

export interface MemberResult {
  userId: string;
  incomeCents: number;
  /** income / combined income, as a float for display (round at display time). */
  ratio: number;
  owedCents: number;
  paidCents: number;
  /** paid - owed. Positive → owed money; negative → owes money. */
  balanceCents: number;
}

export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export type SettlementResult =
  | {
      status: "pending";
      totalSharedCents: number;
      /** Members who have not yet entered an income for the period. */
      missingIncomeUserIds: string[];
    }
  | { status: "zero-income"; totalSharedCents: number }
  | {
      status: "ready";
      totalSharedCents: number;
      combinedIncomeCents: number;
      members: MemberResult[];
      transfers: Transfer[];
    };

function sumSharedExpenses(expenses: SettlementExpense[]): number {
  return expenses
    .filter((e) => e.type === "shared")
    .reduce((acc, e) => acc + e.amountCents, 0);
}

function paidByMember(expenses: SettlementExpense[], userId: string): number {
  // Personal expenses never count toward what a member "paid" into the pool.
  return expenses
    .filter((e) => e.type === "shared" && e.paidByUserId === userId)
    .reduce((acc, e) => acc + e.amountCents, 0);
}

/**
 * Split `totalCents` across members proportionally to income using the
 * largest-remainder method. Guarantees the returned integer shares sum exactly
 * to `totalCents`. Leftover cents are assigned to the largest fractional
 * remainders first; ties broken deterministically by lowest userId.
 */
function allocateOwed(
  members: { userId: string; incomeCents: number }[],
  combinedIncomeCents: number,
  totalCents: number,
): Map<string, number> {
  const exact = members.map((m) => {
    const value = (m.incomeCents / combinedIncomeCents) * totalCents;
    const floor = Math.floor(value);
    return { userId: m.userId, floor, remainder: value - floor };
  });

  const distributed = exact.reduce((acc, e) => acc + e.floor, 0);
  let leftover = totalCents - distributed;

  // Order by descending remainder, then ascending userId for determinism.
  const order = [...exact].sort(
    (a, b) => b.remainder - a.remainder || (a.userId < b.userId ? -1 : 1),
  );

  const owed = new Map<string, number>();
  for (const e of exact) owed.set(e.userId, e.floor);
  for (const e of order) {
    if (leftover <= 0) break;
    owed.set(e.userId, (owed.get(e.userId) ?? 0) + 1);
    leftover -= 1;
  }
  return owed;
}

/**
 * Greedy minimum-transfer settlement. For two people this is a single transfer;
 * the algorithm generalises to more members for the future. Transfers are
 * deterministic (debtors and creditors are sorted by userId).
 */
function computeTransfers(members: MemberResult[]): Transfer[] {
  const debtors = members
    .filter((m) => m.balanceCents < 0)
    .map((m) => ({ userId: m.userId, amount: -m.balanceCents }))
    .sort((a, b) => (a.userId < b.userId ? -1 : 1));
  const creditors = members
    .filter((m) => m.balanceCents > 0)
    .map((m) => ({ userId: m.userId, amount: m.balanceCents }))
    .sort((a, b) => (a.userId < b.userId ? -1 : 1));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amountCents: amount,
      });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

export function computeSettlement(input: SettlementInput): SettlementResult {
  const totalSharedCents = sumSharedExpenses(input.expenses);

  const incomeByUser = new Map(input.incomes.map((i) => [i.userId, i.amountCents]));
  const missingIncomeUserIds = input.memberIds.filter((id) => !incomeByUser.has(id));
  if (missingIncomeUserIds.length > 0) {
    return { status: "pending", totalSharedCents, missingIncomeUserIds };
  }

  const combinedIncomeCents = input.memberIds.reduce(
    (acc, id) => acc + (incomeByUser.get(id) ?? 0),
    0,
  );
  if (combinedIncomeCents === 0) {
    return { status: "zero-income", totalSharedCents };
  }

  const membersForAlloc = input.memberIds.map((id) => ({
    userId: id,
    incomeCents: incomeByUser.get(id) ?? 0,
  }));
  const owedByUser = allocateOwed(membersForAlloc, combinedIncomeCents, totalSharedCents);

  const members: MemberResult[] = input.memberIds.map((id) => {
    const incomeCents = incomeByUser.get(id) ?? 0;
    const owedCents = owedByUser.get(id) ?? 0;
    const paidCents = paidByMember(input.expenses, id);
    return {
      userId: id,
      incomeCents,
      ratio: incomeCents / combinedIncomeCents,
      owedCents,
      paidCents,
      balanceCents: paidCents - owedCents,
    };
  });

  return {
    status: "ready",
    totalSharedCents,
    combinedIncomeCents,
    members,
    transfers: computeTransfers(members),
  };
}
