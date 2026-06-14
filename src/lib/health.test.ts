import { describe, it, expect } from "vitest";
import { computeHealthMetrics, type MonthlyIncomeEntry, type MonthlyContributionEntry, type FundBalanceEntry, type MonthlySharedSpend } from "./health";

const incomes: MonthlyIncomeEntry[] = [
  { userId: "A", monthKey: "2026-04", amountCents: 300_000 },
  { userId: "B", monthKey: "2026-04", amountCents: 200_000 },
  { userId: "A", monthKey: "2026-05", amountCents: 300_000 },
  { userId: "B", monthKey: "2026-05", amountCents: 200_000 },
  { userId: "A", monthKey: "2026-06", amountCents: 300_000 },
  { userId: "B", monthKey: "2026-06", amountCents: 200_000 },
];

const contributions: MonthlyContributionEntry[] = [
  // A saves 10% = 30k/mo; B saves 10% = 20k/mo
  { userId: "A", monthKey: "2026-04", fundId: "f-savings-a", amountCents: 30_000 },
  { userId: "B", monthKey: "2026-04", fundId: "f-savings-b", amountCents: 20_000 },
  { userId: "A", monthKey: "2026-05", fundId: "f-savings-a", amountCents: 30_000 },
  { userId: "B", monthKey: "2026-05", fundId: "f-savings-b", amountCents: 20_000 },
  { userId: "A", monthKey: "2026-06", fundId: "f-savings-a", amountCents: 30_000 },
  { userId: "B", monthKey: "2026-06", fundId: "f-savings-b", amountCents: 20_000 },
];

const funds: FundBalanceEntry[] = [
  {
    fundId: "f-savings-a",
    fundName: "Savings A",
    scope: "personal",
    ownerUserId: "A",
    isPrivate: false,
    balanceCents: 90_000,
    targetCents: 300_000,
    projectedCompletionMonthKey: "2027-06",
  },
  {
    fundId: "f-savings-b",
    fundName: "Savings B",
    scope: "personal",
    ownerUserId: "B",
    isPrivate: false,
    balanceCents: 60_000,
    targetCents: 200_000,
    projectedCompletionMonthKey: "2027-06",
  },
  {
    fundId: "f-emergency",
    fundName: "Emergency",
    scope: "couple",
    ownerUserId: null,
    isPrivate: false,
    balanceCents: 300_000,
    targetCents: null,
    projectedCompletionMonthKey: null,
  },
];

const sharedSpendHistory: MonthlySharedSpend[] = [
  { monthKey: "2026-01", totalSharedCents: 100_000 },
  { monthKey: "2026-02", totalSharedCents: 110_000 },
  { monthKey: "2026-03", totalSharedCents: 105_000 },
  { monthKey: "2026-04", totalSharedCents: 108_000 },
  { monthKey: "2026-05", totalSharedCents: 102_000 },
  { monthKey: "2026-06", totalSharedCents: 107_000 },
];

function makeMetrics(requestingUserId = "A") {
  return computeHealthMetrics({
    currentMonthKey: "2026-06",
    incomes,
    contributions,
    funds,
    emergencyFundIds: ["f-emergency"],
    sharedSpendHistory,
    perUserPlannedDiscretionaryCents: { A: 170_000, B: 120_000 },
    perUserSelfReport: { A: "fine", B: null },
    requestingUserId,
  });
}

describe("computeHealthMetrics – savings rate", () => {
  it("combined rate for current month is 10%", () => {
    const m = makeMetrics();
    // Total income 500k, total contributions 50k → 1000 bps = 10%
    expect(m.savingsRate.currentMonthBps).toBe(1000);
  });

  it("trailing 3-month rate is consistent at 10%", () => {
    const m = makeMetrics();
    expect(m.savingsRate.trailing3Bps).toBe(1000);
  });

  it("per-user rate for A is 10%", () => {
    const m = makeMetrics();
    expect(m.savingsRate.perUserCurrentBps["A"]).toBe(1000);
  });
});

describe("computeHealthMetrics – emergency runway", () => {
  it("computes runway from balance / avg monthly shared spend", () => {
    const m = makeMetrics();
    // emergency balance 300k, avg of last 6 months ≈ (100+110+105+108+102+107)/6 = 105.3k
    // runway ≈ 300/105.3 ≈ 2.85 months
    expect(m.emergencyRunway.runwayMonths).toBeCloseTo(2.85, 1);
  });

  it("band is 'low' when runway < 3 months", () => {
    const m = makeMetrics();
    expect(m.emergencyRunway.band).toBe("low");
  });

  it("band is 'ok' for 3–6 months", () => {
    const metrics = computeHealthMetrics({
      currentMonthKey: "2026-06",
      incomes,
      contributions,
      funds: [{ ...funds[2], balanceCents: 400_000 }],
      emergencyFundIds: ["f-emergency"],
      sharedSpendHistory,
      perUserPlannedDiscretionaryCents: {},
      perUserSelfReport: {},
      requestingUserId: "A",
    });
    expect(metrics.emergencyRunway.band).toBe("ok");
  });
});

describe("computeHealthMetrics – goal funding", () => {
  it("returns progress ratio for funds with targets", () => {
    const m = makeMetrics();
    const savA = m.goalFunding.find((f) => f.fundId === "f-savings-a")!;
    expect(savA.progressRatio).toBeCloseTo(0.3, 2); // 90k/300k
  });

  it("progressRatio null for funds without target", () => {
    const m = makeMetrics();
    const emer = m.goalFunding.find((f) => f.fundId === "f-emergency")!;
    expect(emer.progressRatio).toBeNull();
  });

  it("private personal fund hidden from non-owner", () => {
    const privateFunds: FundBalanceEntry[] = [
      ...funds,
      {
        fundId: "f-private-b",
        fundName: "B Secret",
        scope: "personal",
        ownerUserId: "B",
        isPrivate: true,
        balanceCents: 50_000,
        targetCents: 100_000,
        projectedCompletionMonthKey: null,
      },
    ];
    const m = computeHealthMetrics({
      currentMonthKey: "2026-06",
      incomes,
      contributions,
      funds: privateFunds,
      emergencyFundIds: ["f-emergency"],
      sharedSpendHistory,
      perUserPlannedDiscretionaryCents: {},
      perUserSelfReport: {},
      requestingUserId: "A", // not B
    });
    expect(m.goalFunding.find((f) => f.fundId === "f-private-b")).toBeUndefined();
  });

  it("private fund visible to its own owner", () => {
    const privateFunds: FundBalanceEntry[] = [
      ...funds,
      {
        fundId: "f-private-b",
        fundName: "B Secret",
        scope: "personal",
        ownerUserId: "B",
        isPrivate: true,
        balanceCents: 50_000,
        targetCents: 100_000,
        projectedCompletionMonthKey: null,
      },
    ];
    const m = computeHealthMetrics({
      currentMonthKey: "2026-06",
      incomes,
      contributions,
      funds: privateFunds,
      emergencyFundIds: ["f-emergency"],
      sharedSpendHistory,
      perUserPlannedDiscretionaryCents: {},
      perUserSelfReport: {},
      requestingUserId: "B",
    });
    expect(m.goalFunding.find((f) => f.fundId === "f-private-b")).toBeDefined();
  });
});

describe("computeHealthMetrics – shared burn trend", () => {
  it("does not flag creep when spend is stable", () => {
    const m = makeMetrics();
    expect(m.sharedBurnTrend.sustainedCreep).toBe(false);
  });

  it("flags sustained creep when last 3 months consistently above prior 6-month avg", () => {
    const creepeHistory: MonthlySharedSpend[] = [
      { monthKey: "2026-01", totalSharedCents: 100_000 },
      { monthKey: "2026-02", totalSharedCents: 100_000 },
      { monthKey: "2026-03", totalSharedCents: 100_000 },
      { monthKey: "2026-04", totalSharedCents: 140_000 }, // creep starts
      { monthKey: "2026-05", totalSharedCents: 145_000 },
      { monthKey: "2026-06", totalSharedCents: 150_000 },
      // The prior 6 months used for avg are 01-03 (only 3 available in the slice -9:-3),
      // avg ≈ 100k. Last 3 are all > 100k → creep.
    ];
    const m = computeHealthMetrics({
      currentMonthKey: "2026-06",
      incomes,
      contributions,
      funds,
      emergencyFundIds: ["f-emergency"],
      sharedSpendHistory: creepeHistory,
      perUserPlannedDiscretionaryCents: {},
      perUserSelfReport: {},
      requestingUserId: "A",
    });
    expect(m.sharedBurnTrend.sustainedCreep).toBe(true);
  });
});

describe("computeHealthMetrics – discretionary comfort", () => {
  it("only shows requesting user's own discretionary", () => {
    const m = makeMetrics("A");
    expect(m.discretionaryComfort.perUserPlannedDiscretionaryCents["A"]).toBe(170_000);
    expect(m.discretionaryComfort.perUserPlannedDiscretionaryCents["B"]).toBeUndefined();
  });

  it("includes own self-report", () => {
    const m = makeMetrics("A");
    expect(m.discretionaryComfort.perUserSelfReport["A"]).toBe("fine");
  });
});
