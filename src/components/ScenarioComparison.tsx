import type { ScenarioComparisonResult } from "@/lib/projection";
import type { ProjectionUserData } from "@/lib/data";
import { formatCents } from "@/lib/money";
import { formatMonthKey } from "@/lib/month";
import { promoteScenarioAction } from "@/app/plan-actions";

interface ScenarioComparisonProps {
  scenarioId: string;
  scenarioName: string;
  baselineName: string;
  comparison: ScenarioComparisonResult;
  users: ProjectionUserData[];
}

export function ScenarioComparison({
  scenarioId,
  scenarioName,
  baselineName,
  comparison,
  users,
}: ScenarioComparisonProps) {
  const userById = new Map(users.map((u) => [u.userId, u]));

  // Summary sentence: biggest ETA improvement + biggest discretionary cost
  const bestEta = comparison.fundEtaDeltas
    .filter((d) => d.monthsDelta !== null && d.monthsDelta > 0)
    .sort((a, b) => (b.monthsDelta ?? 0) - (a.monthsDelta ?? 0))[0];

  const totalDiscretionaryDelta = comparison.userDiscretionaryDeltas.reduce(
    (s, u) => s + u.avgMonthlyDeltaCents,
    0,
  );

  return (
    <div className="rounded-[var(--radius)] border border-brand/30 bg-brand-soft overflow-hidden">
      {/* Trade-off hero */}
      <div className="px-5 py-4 border-b border-brand/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Scenario comparison</p>
            <p className="text-base font-semibold text-ink">
              <span className="text-muted">{baselineName}</span>
              <span className="mx-2 text-faint">vs</span>
              <span>{scenarioName}</span>
            </p>
          </div>
          <form action={promoteScenarioAction.bind(null, scenarioId)}>
            <button
              type="submit"
              className="rounded-[var(--radius)] border border-brand bg-surface px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft transition-colors whitespace-nowrap"
            >
              Promote to baseline
            </button>
          </form>
        </div>

        {/* Summary trade-off sentence */}
        {(bestEta || totalDiscretionaryDelta !== 0) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {bestEta && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-owed/15 px-3 py-1 text-sm font-medium text-owed">
                {bestEta.fundName}: {bestEta.monthsDelta} months sooner
              </span>
            )}
            {totalDiscretionaryDelta !== 0 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                  totalDiscretionaryDelta < 0
                    ? "bg-owes/10 text-owes"
                    : "bg-owed/15 text-owed"
                }`}
              >
                Combined discretionary:{" "}
                {totalDiscretionaryDelta >= 0 ? "+" : ""}
                {formatCents(totalDiscretionaryDelta)}/mo
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-brand/20">
        {/* Fund ETAs */}
        <div className="px-5 py-4">
          <p className="eyebrow mb-3">Fund completion dates</p>
          <div className="flex flex-col gap-2">
            {comparison.fundEtaDeltas.map((d) => (
              <div key={d.fundId} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted truncate max-w-28">{d.fundName}</span>
                <div className="text-right flex-shrink-0">
                  <span className="text-faint line-through mr-2">
                    {d.baselineCompletionMonthKey
                      ? formatMonthKey(d.baselineCompletionMonthKey)
                      : "—"}
                  </span>
                  <span
                    className={
                      d.scenarioCompletionMonthKey
                        ? d.monthsDelta !== null && d.monthsDelta > 0
                          ? "text-owed font-medium"
                          : "text-ink"
                        : "text-faint"
                    }
                  >
                    {d.scenarioCompletionMonthKey
                      ? formatMonthKey(d.scenarioCompletionMonthKey)
                      : "—"}
                  </span>
                  {d.monthsDelta !== null && d.monthsDelta !== 0 && (
                    <span
                      className={`ml-1.5 text-xs ${d.monthsDelta > 0 ? "text-owed" : "text-owes"}`}
                    >
                      {d.monthsDelta > 0 ? `+${d.monthsDelta}mo` : `${d.monthsDelta}mo`}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {comparison.fundEtaDeltas.length === 0 && (
              <p className="text-sm text-faint">No funded goals to compare</p>
            )}
          </div>
        </div>

        {/* Discretionary deltas */}
        <div className="px-5 py-4">
          <p className="eyebrow mb-3">Monthly discretionary impact</p>
          <div className="flex flex-col gap-2">
            {comparison.userDiscretionaryDeltas.map((ud) => {
              const user = userById.get(ud.userId);
              if (!user) return null;
              const positive = ud.avgMonthlyDeltaCents >= 0;
              return (
                <div
                  key={ud.userId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted">{user.displayName}</span>
                  <span
                    className={`tabular font-medium ${positive ? "text-owed" : "text-owes"}`}
                  >
                    {positive ? "+" : ""}
                    {formatCents(ud.avgMonthlyDeltaCents)}/mo
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
