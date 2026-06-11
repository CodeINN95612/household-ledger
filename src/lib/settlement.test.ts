import { describe, it, expect } from "vitest";
import { computeSettlement, type SettlementInput } from "./settlement";

describe("computeSettlement", () => {
  it("matches the spec's worked example (A/B 60/40, $1000 shared)", () => {
    // A: $3000 income (60%), B: $2000 (40%). Shared total $1000.
    // A fronted $900, B fronted $100. → B sends A $300.
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 300_000 },
        { userId: "B", amountCents: 200_000 },
      ],
      expenses: [
        { paidByUserId: "A", amountCents: 90_000, type: "shared" },
        { paidByUserId: "B", amountCents: 10_000, type: "shared" },
      ],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.totalSharedCents).toBe(100_000);

    const a = result.members.find((m) => m.userId === "A")!;
    const b = result.members.find((m) => m.userId === "B")!;
    expect(a.owedCents).toBe(60_000);
    expect(a.paidCents).toBe(90_000);
    expect(a.balanceCents).toBe(30_000);
    expect(b.owedCents).toBe(40_000);
    expect(b.paidCents).toBe(10_000);
    expect(b.balanceCents).toBe(-30_000);

    expect(result.transfers).toEqual([
      { fromUserId: "B", toUserId: "A", amountCents: 30_000 },
    ]);
  });

  it("excludes personal expenses from the shared pool and from paid", () => {
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 100_000 },
        { userId: "B", amountCents: 100_000 },
      ],
      expenses: [
        { paidByUserId: "A", amountCents: 50_000, type: "shared" },
        { paidByUserId: "A", amountCents: 99_999, type: "personal" }, // ignored
        { paidByUserId: "B", amountCents: 12_345, type: "personal" }, // ignored
      ],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.totalSharedCents).toBe(50_000);
    const a = result.members.find((m) => m.userId === "A")!;
    const b = result.members.find((m) => m.userId === "B")!;
    // 50/50 split of $500 shared, A fronted it all.
    expect(a.owedCents).toBe(25_000);
    expect(a.paidCents).toBe(50_000); // personal $999.99 not counted
    expect(b.owedCents).toBe(25_000);
    expect(b.paidCents).toBe(0);
    expect(result.transfers).toEqual([
      { fromUserId: "B", toUserId: "A", amountCents: 25_000 },
    ]);
  });

  it("rounds owed shares so they sum exactly to the shared total", () => {
    // 1/3 vs 2/3 of an odd total → exact split is fractional cents.
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 100 }, // 1/3
        { userId: "B", amountCents: 200 }, // 2/3
      ],
      expenses: [
        { paidByUserId: "A", amountCents: 1_001, type: "shared" }, // $10.01
      ],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const a = result.members.find((m) => m.userId === "A")!;
    const b = result.members.find((m) => m.userId === "B")!;
    // Exact: A = 333.66.., B = 667.33.. → floors 333/667 leave 1 leftover cent.
    // Largest remainder (A .66 > B .33) gives the cent to A.
    expect(a.owedCents).toBe(334);
    expect(b.owedCents).toBe(667);
    expect(a.owedCents + b.owedCents).toBe(1_001);
  });

  it("returns 'pending' when an income is missing", () => {
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [{ userId: "A", amountCents: 100_000 }],
      expenses: [{ paidByUserId: "A", amountCents: 5_000, type: "shared" }],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("pending");
    if (result.status !== "pending") return;
    expect(result.missingIncomeUserIds).toEqual(["B"]);
    expect(result.totalSharedCents).toBe(5_000);
  });

  it("returns 'zero-income' instead of dividing by zero", () => {
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 0 },
        { userId: "B", amountCents: 0 },
      ],
      expenses: [{ paidByUserId: "A", amountCents: 5_000, type: "shared" }],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("zero-income");
    if (result.status !== "zero-income") return;
    expect(result.totalSharedCents).toBe(5_000);
  });

  it("handles a month with incomes but no shared expenses (all balances zero)", () => {
    const input: SettlementInput = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 300_000 },
        { userId: "B", amountCents: 200_000 },
      ],
      expenses: [
        { paidByUserId: "A", amountCents: 4_200, type: "personal" }, // ignored
      ],
    };

    const result = computeSettlement(input);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.totalSharedCents).toBe(0);
    expect(result.members.every((m) => m.balanceCents === 0)).toBe(true);
    expect(result.transfers).toEqual([]);
  });

  it("is order-independent: settlement is identical regardless of who fronts", () => {
    const base = {
      memberIds: ["A", "B"],
      incomes: [
        { userId: "A", amountCents: 300_000 },
        { userId: "B", amountCents: 200_000 },
      ],
    };
    // Same $1000 shared total, but B fronts everything this time.
    const variant1 = computeSettlement({
      ...base,
      expenses: [{ paidByUserId: "A", amountCents: 100_000, type: "shared" }],
    });
    const variant2 = computeSettlement({
      ...base,
      expenses: [
        { paidByUserId: "B", amountCents: 60_000, type: "shared" },
        { paidByUserId: "A", amountCents: 40_000, type: "shared" },
      ],
    });

    if (variant1.status !== "ready" || variant2.status !== "ready") {
      throw new Error("expected ready");
    }
    // Owed shares depend only on income + total, not on who paid.
    const owed1 = variant1.members.map((m) => [m.userId, m.owedCents]);
    const owed2 = variant2.members.map((m) => [m.userId, m.owedCents]);
    expect(owed1).toEqual(owed2);
  });
});
