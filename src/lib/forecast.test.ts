import { describe, it, expect } from "vitest";
import { forecastSharedSpend, computeFloat, type HistoryExpense } from "./forecast";

function makeExpense(
  monthKey: string,
  description: string,
  amountCents: number,
  isRecurringFixed: boolean | null = null,
): HistoryExpense {
  return { monthKey, description, amountCents, type: "shared", isRecurringFixed };
}

describe("forecastSharedSpend", () => {
  it("empty history returns zero forecast", () => {
    const result = forecastSharedSpend([]);
    expect(result.totalCents).toBe(0);
    expect(result.monthsOfHistory).toBe(0);
    expect(result.isLowConfidence).toBe(true);
  });

  it("auto-detects fixed recurring expense (rent same amount 3+ months)", () => {
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Rent", 150_000),
      makeExpense("2026-02", "Rent", 150_000),
      makeExpense("2026-03", "Rent", 150_000),
      makeExpense("2026-04", "Rent", 150_000),
    ];
    const result = forecastSharedSpend(expenses);
    const rentLine = result.lines.find((l) => l.description === "Rent");
    expect(rentLine).toBeDefined();
    expect(rentLine!.isFixed).toBe(true);
    expect(rentLine!.amountCents).toBe(150_000);
  });

  it("manual override forces fixed=true even for variable amounts", () => {
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Internet", 8_000, true),
      makeExpense("2026-02", "Internet", 9_000, true), // would fail auto-detect
    ];
    const result = forecastSharedSpend(expenses);
    const line = result.lines.find((l) => l.description.toLowerCase().includes("internet"));
    expect(line!.isFixed).toBe(true);
  });

  it("manual override forces fixed=false for consistent amounts", () => {
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Gym", 5_000, false),
      makeExpense("2026-02", "Gym", 5_000, false),
      makeExpense("2026-03", "Gym", 5_000, false),
      makeExpense("2026-04", "Gym", 5_000, false),
    ];
    const result = forecastSharedSpend(expenses);
    const line = result.lines.find((l) => l.description.toLowerCase().includes("gym"));
    expect(line!.isFixed).toBe(false);
  });

  it("uses 3-month rolling average for variable spend", () => {
    // 3 months of variable spend: 10k, 20k, 30k → avg = 20k
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Groceries", 10_000),
      makeExpense("2026-02", "Groceries", 20_000),
      makeExpense("2026-03", "Groceries", 30_000),
    ];
    const result = forecastSharedSpend(expenses);
    const line = result.lines.find((l) => l.description === "Groceries");
    expect(line!.isFixed).toBe(false);
    expect(line!.amountCents).toBe(20_000);
  });

  it("flags low confidence when < 3 months of history", () => {
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Food", 10_000),
      makeExpense("2026-02", "Food", 12_000),
    ];
    const result = forecastSharedSpend(expenses);
    expect(result.isLowConfidence).toBe(true);
  });

  it("excludes personal expenses from forecast", () => {
    const expenses: HistoryExpense[] = [
      { monthKey: "2026-01", description: "Personal lunch", amountCents: 5_000, type: "personal", isRecurringFixed: null },
      makeExpense("2026-01", "Rent", 150_000),
    ];
    const result = forecastSharedSpend(expenses);
    expect(result.lines.find((l) => l.description === "Personal lunch")).toBeUndefined();
    expect(result.lines.find((l) => l.description === "Rent")).toBeDefined();
  });

  it("totalCents = totalFixed + totalVariable", () => {
    const expenses: HistoryExpense[] = [
      makeExpense("2026-01", "Rent", 150_000),
      makeExpense("2026-02", "Rent", 150_000),
      makeExpense("2026-03", "Rent", 150_000),
      makeExpense("2026-01", "Groceries", 20_000),
      makeExpense("2026-02", "Groceries", 25_000),
      makeExpense("2026-03", "Groceries", 30_000),
    ];
    const result = forecastSharedSpend(expenses);
    expect(result.totalCents).toBe(result.totalFixedCents + result.totalVariableCents);
  });
});

describe("computeFloat", () => {
  it("outstanding = fronted − reimbursed", () => {
    const result = computeFloat({
      currentMonthFrontedCents: 100_000,
      currentMonthReimbursedCents: 40_000,
      historicalOutstandingCents: [],
    });
    expect(result.outstandingCents).toBe(60_000);
  });

  it("recommended reserve is trailing max rounded up to $50", () => {
    const result = computeFloat({
      currentMonthFrontedCents: 0,
      currentMonthReimbursedCents: 0,
      historicalOutstandingCents: [80_000, 95_000, 73_000, 88_000, 102_000, 91_000],
    });
    // peak = 102_000 → round up to nearest 5000 = 105_000
    expect(result.recommendedReserveCents).toBe(105_000);
  });

  it("uses manual override when provided", () => {
    const result = computeFloat({
      currentMonthFrontedCents: 50_000,
      currentMonthReimbursedCents: 0,
      historicalOutstandingCents: [200_000],
      reserveOverrideCents: 75_000,
    });
    expect(result.recommendedReserveCents).toBe(75_000);
  });

  it("uses current outstanding when no history available", () => {
    const result = computeFloat({
      currentMonthFrontedCents: 80_000,
      currentMonthReimbursedCents: 10_000,
      historicalOutstandingCents: [],
    });
    // peak = outstanding = 70_000 → round up to 70_000
    expect(result.recommendedReserveCents).toBe(70_000);
  });

  it("zero fronted = zero outstanding", () => {
    const result = computeFloat({
      currentMonthFrontedCents: 0,
      currentMonthReimbursedCents: 0,
      historicalOutstandingCents: [],
    });
    expect(result.outstandingCents).toBe(0);
  });
});
