import { describe, it, expect } from "vitest";
import { computeProjection, compareScenarios, addMonths, type ProjectionInput } from "./projection";

const userA = {
  userId: "A",
  defaultIncomeCents: 300_000,
  incomeOverrides: {},
  allocationRules: [
    { fundId: "fund-savings", fundName: "Savings", percentBps: 1000, fixedCentsOverride: null },
    { fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null },
  ],
  floatReserveCents: 80_000,
};

const userB = {
  userId: "B",
  defaultIncomeCents: 200_000,
  incomeOverrides: {},
  allocationRules: [
    { fundId: "fund-savings-b", fundName: "Savings B", percentBps: 1000, fixedCentsOverride: null },
    { fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null },
  ],
  floatReserveCents: 0,
};

const baseInput: ProjectionInput = {
  startMonthKey: "2026-07",
  horizonMonths: 3,
  users: [userA, userB],
  funds: [
    { fundId: "fund-savings", fundName: "Savings A", scope: "personal", ownerUserId: "A", targetCents: 100_000, startingBalanceCents: 0 },
    { fundId: "fund-savings-b", fundName: "Savings B", scope: "personal", ownerUserId: "B", targetCents: 100_000, startingBalanceCents: 0 },
    { fundId: "fund-house", fundName: "House", scope: "couple", ownerUserId: null, targetCents: 500_000, startingBalanceCents: 10_000 },
  ],
  forecastSharedSpendCents: 100_000,
};

describe("addMonths", () => {
  it("advances month within a year", () => {
    expect(addMonths("2026-06", 1)).toBe("2026-07");
    expect(addMonths("2026-06", 6)).toBe("2026-12");
  });

  it("wraps across year boundary", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("handles zero offset", () => {
    expect(addMonths("2026-06", 0)).toBe("2026-06");
  });
});

describe("computeProjection", () => {
  it("produces the correct number of months", () => {
    const result = computeProjection(baseInput);
    expect(result.months).toHaveLength(3);
  });

  it("monthKeys are sequential from start", () => {
    const result = computeProjection(baseInput);
    expect(result.months[0].monthKey).toBe("2026-07");
    expect(result.months[1].monthKey).toBe("2026-08");
    expect(result.months[2].monthKey).toBe("2026-09");
  });

  it("user slices contain both users each month", () => {
    const result = computeProjection(baseInput);
    result.months.forEach((m) => {
      expect(m.users.map((u) => u.userId).sort()).toEqual(["A", "B"]);
    });
  });

  it("proportional shared owed matches income ratios (60/40)", () => {
    const result = computeProjection(baseInput);
    const month = result.months[0];
    const a = month.users.find((u) => u.userId === "A")!;
    const b = month.users.find((u) => u.userId === "B")!;
    // 60/40 split of 100_000: A = floor(60000) = 60000, B = 40000
    expect(a.sharedOwedCents).toBe(60_000);
    expect(b.sharedOwedCents).toBe(40_000);
  });

  it("fund balances accumulate correctly across months", () => {
    const result = computeProjection(baseInput);
    // House: starts 10_000; A contributes 10% of 300k = 30k/mo, B contributes 10% of 200k = 20k/mo
    // month 1: 10_000 + 50_000 = 60_000
    // month 2: 60_000 + 50_000 = 110_000
    const houseSlices = result.months.map((m) => m.funds.find((f) => f.fundId === "fund-house")!);
    expect(houseSlices[0].balanceCents).toBe(60_000);
    expect(houseSlices[1].balanceCents).toBe(110_000);
  });

  it("stops contributing to a fund after target is reached", () => {
    const smallTargetInput: ProjectionInput = {
      ...baseInput,
      funds: [
        { fundId: "fund-house", fundName: "House", scope: "couple", ownerUserId: null, targetCents: 70_000, startingBalanceCents: 10_000, onCompletion: "stop" },
      ],
      users: [{ ...userA, allocationRules: [{ fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null }] }],
    };
    const result = computeProjection(smallTargetInput);
    const slices = result.months.map((m) => m.funds.find((f) => f.fundId === "fund-house")!);
    // month 1: 10k + 30k = 40k; month 2: 40k + 30k = 70k (target reached, cap at 70k)
    expect(slices[1].balanceCents).toBe(70_000);
    expect(slices[1].targetReached).toBe(true);
    // month 3: stops contributing, stays at 70k
    expect(slices[2].balanceCents).toBe(70_000);
  });

  it("fund completion date is recorded correctly", () => {
    const result = computeProjection({
      ...baseInput,
      funds: [
        { fundId: "fund-house", fundName: "House", scope: "couple", ownerUserId: null, targetCents: 60_000, startingBalanceCents: 10_000, onCompletion: "stop" },
      ],
      users: [{ ...userA, allocationRules: [{ fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null }] }],
    });
    const completion = result.fundCompletions.find((f) => f.fundId === "fund-house")!;
    // 10k + 30k = 40k (month 1), 40k + 30k = 70k ≥ 60k (month 2, capped)
    expect(completion.completionMonthKey).toBe("2026-08");
  });

  it("null completion when fund not reached within horizon", () => {
    const result = computeProjection(baseInput);
    const house = result.fundCompletions.find((f) => f.fundId === "fund-house")!;
    // target 500k, starting 10k, 50k/mo × 3 = 160k → not reached
    expect(house.completionMonthKey).toBeNull();
  });

  it("income override applies only to specified month", () => {
    const input: ProjectionInput = {
      ...baseInput,
      users: [{ ...userA, incomeOverrides: { "2026-08": 400_000 } }, userB],
    };
    const result = computeProjection(input);
    expect(result.months[0].users.find((u) => u.userId === "A")!.incomeCents).toBe(300_000);
    expect(result.months[1].users.find((u) => u.userId === "A")!.incomeCents).toBe(400_000);
    expect(result.months[2].users.find((u) => u.userId === "A")!.incomeCents).toBe(300_000);
  });

  it("shared spend override applies only to specified month", () => {
    const input: ProjectionInput = {
      ...baseInput,
      sharedSpendOverrides: { "2026-08": 150_000 },
    };
    const result = computeProjection(input);
    const m1 = result.months[0].users.find((u) => u.userId === "A")!;
    const m2 = result.months[1].users.find((u) => u.userId === "A")!;
    // m1 uses default 100k, m2 uses 150k
    expect(m1.sharedOwedCents).toBe(60_000); // 60% of 100k
    expect(m2.sharedOwedCents).toBe(90_000); // 60% of 150k
  });

  it("zero combined income → shared owed is 0, no divide-by-zero", () => {
    const input: ProjectionInput = {
      ...baseInput,
      users: [
        { ...userA, defaultIncomeCents: 0 },
        { ...userB, defaultIncomeCents: 0 },
      ],
    };
    const result = computeProjection(input);
    result.months.forEach((m) =>
      m.users.forEach((u) => expect(u.sharedOwedCents).toBe(0)),
    );
  });
});

describe("compareScenarios", () => {
  it("returns zero deltas when baseline and scenario are identical", () => {
    const result = computeProjection(baseInput);
    const comparison = compareScenarios(result, result);
    comparison.userDiscretionaryDeltas.forEach((u) => {
      expect(u.avgMonthlyDeltaCents).toBe(0);
    });
    comparison.fundEtaDeltas.forEach((f) => {
      // Both null or same date → monthsDelta should be 0 or null
      if (f.monthsDelta !== null) expect(f.monthsDelta).toBe(0);
    });
  });

  it("higher allocation → earlier completion and lower discretionary", () => {
    const higherAlloc: ProjectionInput = {
      ...baseInput,
      horizonMonths: 24,
      users: [
        {
          ...userA,
          defaultIncomeCents: 300_000,
          allocationRules: [
            { fundId: "fund-house", fundName: "House", percentBps: 1500, fixedCentsOverride: null }, // 15% vs 10%
          ],
        },
        {
          ...userB,
          allocationRules: [
            { fundId: "fund-house", fundName: "House", percentBps: 1500, fixedCentsOverride: null },
          ],
        },
      ],
      funds: [
        { fundId: "fund-house", fundName: "House", scope: "couple", ownerUserId: null, targetCents: 500_000, startingBalanceCents: 10_000, onCompletion: "stop" },
      ],
    };
    const baseResult = computeProjection({ ...baseInput, horizonMonths: 24, users: [
      { ...userA, allocationRules: [{ fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null }] },
      { ...userB, allocationRules: [{ fundId: "fund-house", fundName: "House", percentBps: 1000, fixedCentsOverride: null }] },
    ], funds: [
      { fundId: "fund-house", fundName: "House", scope: "couple", ownerUserId: null, targetCents: 500_000, startingBalanceCents: 10_000, onCompletion: "stop" },
    ] });
    const scenResult = computeProjection(higherAlloc);
    const comparison = compareScenarios(baseResult, scenResult);

    const houseDelta = comparison.fundEtaDeltas.find((f) => f.fundId === "fund-house")!;
    // Higher allocation = completes sooner = positive monthsDelta
    expect(houseDelta.monthsDelta).toBeGreaterThan(0);

    // Discretionary drops because more is allocated
    const aDisc = comparison.userDiscretionaryDeltas.find((u) => u.userId === "A")!;
    expect(aDisc.avgMonthlyDeltaCents).toBeLessThan(0);
  });
});
