import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getProjectionData } from "@/lib/data";
import { computeProjection, compareScenarios, type ProjectionInput } from "@/lib/projection";
import type { ScenarioOverrides, ProjectionPageData } from "@/lib/data";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { HorizonSelector } from "@/components/HorizonSelector";
import { ProjectionTable } from "@/components/ProjectionTable";
import { FundCompletionList } from "@/components/FundCompletionList";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { ScenarioComparison } from "@/components/ScenarioComparison";
import { OneOffEventForm } from "@/components/OneOffEventForm";

const VALID_HORIZONS = [6, 12, 18, 24] as const;

function buildProjectionInput(data: ProjectionPageData, overrides: ScenarioOverrides): ProjectionInput {
  return {
    startMonthKey: data.startMonthKey,
    horizonMonths: data.horizonMonths,
    users: data.users.map((u) => {
      const incomeOverride = overrides.incomeByUserId?.[u.userId];
      const ruleOverrides = overrides.allocationRuleOverrides?.filter((r) => r.userId === u.userId) ?? [];

      let rules = [...u.allocationRules];
      for (const ro of ruleOverrides) {
        const idx = rules.findIndex((r) => r.fundId === ro.fundId);
        const updated = {
          fundId: ro.fundId,
          fundName: rules[idx]?.fundName ?? ro.fundId,
          percentBps: ro.percentBps,
          fixedCentsOverride: ro.fixedCentsOverride,
        };
        if (idx >= 0) rules[idx] = updated;
        else rules = [...rules, updated];
      }

      return {
        userId: u.userId,
        defaultIncomeCents: incomeOverride ?? u.defaultIncomeCents,
        incomeOverrides: {},
        allocationRules: rules,
        floatReserveCents: 0,
      };
    }),
    funds: data.fundInputs,
    forecastSharedSpendCents: overrides.sharedSpendCents ?? data.forecastSharedSpendCents,
  };
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string; scenario?: string }>;
}) {
  const { horizon: horizonParam, scenario: scenarioParam } = await searchParams;

  const horizonRaw = horizonParam ? parseInt(horizonParam, 10) : undefined;
  const horizon = VALID_HORIZONS.includes(horizonRaw as (typeof VALID_HORIZONS)[number])
    ? (horizonRaw as number)
    : undefined;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getProjectionData(user, horizon);

  // Resolve selected scenario
  const selectedScenario = scenarioParam
    ? data.otherScenarios.find((s) => s.id === scenarioParam) ?? null
    : null;

  const displayResult = selectedScenario
    ? computeProjection(buildProjectionInput(data, selectedScenario.overrides))
    : data.baselineResult;

  const comparisonResult = selectedScenario
    ? compareScenarios(data.baselineResult, displayResult)
    : null;

  return (
    <>
      <AppHeader user={user} active="plan" currentMonthKey={data.startMonthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Financial plan</p>
            <h1 className="mt-1 text-xl font-semibold text-ink">Projection</h1>
            <p className="mt-1 text-sm text-muted">
              {data.horizonMonths}-month forecast based on your income and allocation rules
              {data.forecastIsLowConfidence && (
                <span className="ml-2 inline-flex items-center rounded-full bg-owes-soft px-2 py-0.5 text-xs font-medium text-owes">
                  low-confidence forecast
                </span>
              )}
            </p>
          </div>
          <HorizonSelector current={data.horizonMonths} />
        </div>

        <div className="flex flex-col gap-5">
          {/* Scenarios */}
          <Card eyebrow="Scenarios" title="What-if planning">
            <ScenarioPicker
              baseline={data.baselineScenario}
              others={data.otherScenarios}
              selectedId={selectedScenario?.id ?? null}
              users={data.users}
              funds={data.funds}
              forecastSharedSpendCents={data.forecastSharedSpendCents}
              currentHorizon={data.horizonMonths}
            />
          </Card>

          {/* Scenario comparison */}
          {comparisonResult && selectedScenario && (
            <ScenarioComparison
              scenarioId={selectedScenario.id}
              scenarioName={selectedScenario.name}
              baselineName={data.baselineScenario?.name ?? "Baseline"}
              comparison={comparisonResult}
              users={data.users}
            />
          )}

          {/* Hero: the projection table */}
          <Card eyebrow="Month by month" title="Projected cash flow">
            <ProjectionTable
              months={displayResult.months}
              users={data.users}
              funds={data.funds}
              fundCompletions={displayResult.fundCompletions}
            />
          </Card>

          {/* Fund completions */}
          {displayResult.fundCompletions.some(
            (c) => data.funds.find((f) => f.id === c.fundId)?.targetCents,
          ) && (
            <Card eyebrow="Goals" title="Fund completion forecast">
              <FundCompletionList
                completions={displayResult.fundCompletions}
                horizonMonths={data.horizonMonths}
                funds={data.funds}
              />
            </Card>
          )}

          {/* One-off planned events */}
          <Card eyebrow="One-off events" title="Planned one-time costs">
            <OneOffEventForm
              events={data.oneOffEvents}
              startMonthKey={data.startMonthKey}
              horizonMonths={data.horizonMonths}
            />
          </Card>

          {/* Empty state hint when no income entered */}
          {data.users.every((u) => u.defaultIncomeCents === 0) && (
            <div className="rounded-[var(--radius)] border border-dashed border-line px-5 py-6 text-center">
              <p className="text-sm text-muted">
                Enter your income on the{" "}
                <a href={`/statement/${data.startMonthKey}`} className="text-brand hover:underline">
                  statement page
                </a>{" "}
                to see a projection.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
