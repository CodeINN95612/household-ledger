import { describe, it, expect } from "vitest";
import { computeStatement, type AllocationRuleInput } from "./statement";

const ruleA: AllocationRuleInput = {
  fundId: "fund-savings",
  fundName: "Savings",
  percentBps: 1000, // 10%
  fixedCentsOverride: null,
};
const ruleB: AllocationRuleInput = {
  fundId: "fund-emergency",
  fundName: "Emergency",
  percentBps: 1000, // 10%
  fixedCentsOverride: null,
};
const ruleCouple: AllocationRuleInput = {
  fundId: "fund-house",
  fundName: "House",
  percentBps: 1000, // 10%
  fixedCentsOverride: null,
};

describe("computeStatement", () => {
  it("produces correct planned statement matching the spec example", () => {
    // Income $3000, 3 rules each 10% = $300 ea, shared owed $525
    // Discretionary = 3000 - 900 - 525 = $1575
    const result = computeStatement({
      incomeCents: 300_000,
      allocationRules: [ruleA, ruleB, ruleCouple],
      sharedOwedCents: 52_500,
    });

    expect(result.incomeCents).toBe(300_000);
    expect(result.allocationLines).toHaveLength(3);
    expect(result.allocationLines[0].plannedCents).toBe(30_000);
    expect(result.allocationLines[0].actualCents).toBeNull();
    expect(result.totalPlannedAllocationCents).toBe(90_000);
    expect(result.discretionaryPlannedCents).toBe(300_000 - 90_000 - 52_500);
    expect(result.isZeroIncome).toBe(false);
    expect(result.isOverAllocated).toBe(false);
    expect(result.sharedIsEstimated).toBe(false);
  });

  it("handles fixed-amount override instead of percent", () => {
    const fixedRule: AllocationRuleInput = {
      fundId: "f1",
      fundName: "Fixed",
      percentBps: 1000,
      fixedCentsOverride: 50_000, // $500 fixed regardless of income
    };
    const result = computeStatement({
      incomeCents: 300_000,
      allocationRules: [fixedRule],
      sharedOwedCents: 0,
    });
    expect(result.allocationLines[0].plannedCents).toBe(50_000);
  });

  it("shows actual contributions when provided", () => {
    const result = computeStatement({
      incomeCents: 300_000,
      allocationRules: [ruleA, ruleB],
      sharedOwedCents: 50_000,
      actualContributions: [
        { fundId: "fund-savings", amountCents: 28_000 }, // slightly under plan
        { fundId: "fund-emergency", amountCents: 30_000 },
      ],
    });
    expect(result.allocationLines[0].actualCents).toBe(28_000);
    expect(result.allocationLines[1].actualCents).toBe(30_000);
    expect(result.totalActualAllocationCents).toBe(58_000);
    expect(result.discretionaryActualCents).toBe(300_000 - 58_000 - 50_000);
  });

  it("discretionaryActualCents is null when not all contributions recorded", () => {
    const result = computeStatement({
      incomeCents: 300_000,
      allocationRules: [ruleA, ruleB],
      sharedOwedCents: 50_000,
      actualContributions: [{ fundId: "fund-savings", amountCents: 30_000 }], // only one fund
    });
    expect(result.allocationLines[0].actualCents).toBe(30_000);
    expect(result.allocationLines[1].actualCents).toBeNull();
    expect(result.totalActualAllocationCents).toBeNull();
    expect(result.discretionaryActualCents).toBeNull();
  });

  it("zero income → all allocations zero, no divide-by-zero", () => {
    const result = computeStatement({
      incomeCents: 0,
      allocationRules: [ruleA, ruleCouple],
      sharedOwedCents: 0,
    });
    expect(result.isZeroIncome).toBe(true);
    result.allocationLines.forEach((l) => expect(l.plannedCents).toBe(0));
    expect(result.discretionaryPlannedCents).toBe(0);
  });

  it("flags isOverAllocated when rules + shared > income", () => {
    const result = computeStatement({
      incomeCents: 100_000,
      allocationRules: [
        { ...ruleA, percentBps: 5000 }, // 50%
        { ...ruleB, percentBps: 5000 }, // 50%
      ],
      sharedOwedCents: 10_000, // pushes over 100%
    });
    expect(result.isOverAllocated).toBe(true);
    expect(result.discretionaryPlannedCents).toBeLessThan(0);
  });

  it("marks shared as estimated and propagates the flag", () => {
    const result = computeStatement({
      incomeCents: 200_000,
      allocationRules: [ruleA],
      sharedOwedCents: 40_000,
      sharedIsEstimated: true,
    });
    expect(result.sharedIsEstimated).toBe(true);
  });

  it("float reserve appears on result but is not subtracted from discretionary", () => {
    const result = computeStatement({
      incomeCents: 300_000,
      allocationRules: [ruleA],
      sharedOwedCents: 50_000,
      floatReserveCents: 80_000,
    });
    expect(result.floatReserveCents).toBe(80_000);
    // discretionary is still income - allocations - shared, NOT minus float
    expect(result.discretionaryPlannedCents).toBe(300_000 - 30_000 - 50_000);
  });

  it("no allocation rules → full residual is discretionary minus shared", () => {
    const result = computeStatement({
      incomeCents: 500_000,
      allocationRules: [],
      sharedOwedCents: 100_000,
    });
    expect(result.totalPlannedAllocationCents).toBe(0);
    expect(result.discretionaryPlannedCents).toBe(400_000);
  });
});
