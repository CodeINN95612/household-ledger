import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getHealthPageData } from "@/lib/data";
import { formatMonthKey } from "@/lib/month";
import { formatCents } from "@/lib/money";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { HealthMetricCard } from "@/components/HealthMetricCard";
import { SparklineBadge } from "@/components/SparklineBadge";
import { DiscretionaryComfortWidget } from "@/components/DiscretionaryComfortWidget";

function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(1)}%`;
}

function formatRunway(months: number | null): string {
  if (months === null) return "—";
  if (months >= 12) return `${(months / 12).toFixed(1)} yr`;
  return `${months.toFixed(1)} mo`;
}

export default async function HealthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { metrics, users, monthKey } = await getHealthPageData(user);
  const { savingsRate, emergencyRunway, goalFunding, sharedBurnTrend, discretionaryComfort } =
    metrics;

  const displayName = users.find((u) => u.userId === user.id)?.displayName ?? user.displayName;
  const monthLabel = formatMonthKey(monthKey);

  return (
    <>
      <AppHeader user={user} active="health" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6">
          <p className="eyebrow">Financial health</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Health dashboard</h1>
          <p className="mt-1 text-sm text-muted">{monthLabel}</p>
        </div>

        <div className="flex flex-col gap-5">
          {/* Row 1: Savings rate + Emergency runway */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Savings rate */}
            <HealthMetricCard
              eyebrow="Savings rate"
              value={formatBps(savingsRate.currentMonthBps)}
              context={
                savingsRate.currentMonthBps === null
                  ? "No income entered for this month"
                  : undefined
              }
            >
              <div className="flex flex-col gap-1 mt-1">
                {savingsRate.trailing3Bps !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-faint">3-month trailing</span>
                    <span className="text-muted tabular">{formatBps(savingsRate.trailing3Bps)}</span>
                  </div>
                )}
                {savingsRate.trailing12Bps !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-faint">12-month trailing</span>
                    <span className="text-muted tabular">{formatBps(savingsRate.trailing12Bps)}</span>
                  </div>
                )}
                {Object.entries(savingsRate.perUserCurrentBps).map(([uid, bps]) => {
                  const u = users.find((x) => x.userId === uid);
                  if (!u || bps === null) return null;
                  return (
                    <div key={uid} className="flex justify-between text-xs">
                      <span className="text-faint">{u.displayName.split(" ")[0]}</span>
                      <span className="text-muted tabular">{formatBps(bps)}</span>
                    </div>
                  );
                })}
              </div>
            </HealthMetricCard>

            {/* Emergency runway */}
            <HealthMetricCard
              eyebrow="Emergency runway"
              value={formatRunway(emergencyRunway.runwayMonths)}
              band={emergencyRunway.band}
              context={
                emergencyRunway.band === "unknown"
                  ? "Name a fund 'Emergency' to track runway"
                  : emergencyRunway.avgMonthlyEssentialCents !== null
                    ? `Based on ${formatCents(emergencyRunway.avgMonthlyEssentialCents)}/mo shared spend avg`
                    : undefined
              }
            >
              {emergencyRunway.band !== "unknown" && (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`h-1.5 flex-1 rounded-full bg-line overflow-hidden`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        emergencyRunway.band === "strong"
                          ? "bg-owed"
                          : emergencyRunway.band === "ok"
                            ? "bg-[#c59b3a]"
                            : "bg-owes"
                      }`}
                      style={{
                        width: `${Math.min(100, ((emergencyRunway.runwayMonths ?? 0) / 6) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-faint whitespace-nowrap">
                    {emergencyRunway.band === "strong"
                      ? "strong"
                      : emergencyRunway.band === "ok"
                        ? "3–6 months"
                        : "< 3 months"}
                  </span>
                </div>
              )}
            </HealthMetricCard>
          </div>

          {/* Row 2: Shared burn trend */}
          <HealthMetricCard
            eyebrow="Shared spend trend"
            value={
              sharedBurnTrend.prior6MonthAvgCents !== null
                ? formatCents(sharedBurnTrend.prior6MonthAvgCents) + "/mo avg"
                : "—"
            }
            band={sharedBurnTrend.sustainedCreep ? "low" : "unknown"}
          >
            <div className="flex items-center justify-between gap-3 mt-1">
              <div>
                {sharedBurnTrend.sustainedCreep && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-owes-soft px-2.5 py-0.5 text-xs font-medium text-owes">
                    ↑ Creeping up 3+ months
                  </span>
                )}
                {!sharedBurnTrend.sustainedCreep && sharedBurnTrend.monthlyAmounts.length > 0 && (
                  <span className="text-xs text-faint">Stable</span>
                )}
              </div>
              {sharedBurnTrend.monthlyAmounts.length >= 2 && (
                <SparklineBadge
                  values={sharedBurnTrend.monthlyAmounts.map((m) => m.amountCents)}
                  creep={sharedBurnTrend.sustainedCreep}
                  width={80}
                  height={32}
                />
              )}
            </div>
          </HealthMetricCard>

          {/* Row 3: Discretionary comfort */}
          <Card eyebrow="Discretionary comfort" title="Your spending room">
            <DiscretionaryComfortWidget
              comfort={discretionaryComfort}
              requestingUserId={user.id}
              displayName={displayName}
            />
          </Card>

          {/* Row 4: Goal funding */}
          {goalFunding.length > 0 && (
            <Card eyebrow="Goal funding" title="Fund progress">
              <div className="flex flex-col gap-4">
                {goalFunding.map((g) => {
                  const pct = g.progressRatio !== null ? Math.round(g.progressRatio * 100) : null;
                  return (
                    <div key={g.fundId} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink truncate">{g.fundName}</span>
                        <div className="flex items-baseline gap-2 flex-shrink-0">
                          <span className="text-sm tabular text-muted">
                            {formatCents(g.balanceCents)}
                            {g.targetCents ? ` / ${formatCents(g.targetCents)}` : ""}
                          </span>
                          {pct !== null && (
                            <span className="text-xs text-faint">{pct}%</span>
                          )}
                        </div>
                      </div>
                      {g.targetCents !== null && (
                        <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct !== null && pct >= 100 ? "bg-owed" : "bg-brand"
                            }`}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      )}
                      {g.projectedCompletionMonthKey && (
                        <p className="text-xs text-owed font-medium">
                          Projected: {formatMonthKey(g.projectedCompletionMonthKey)}
                        </p>
                      )}
                      {!g.projectedCompletionMonthKey && g.targetCents !== null && (
                        <p className="text-xs text-faint">Not projected to complete in 24 months</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Empty state */}
          {goalFunding.length === 0 && (
            <div className="rounded-[var(--radius)] border border-dashed border-line px-5 py-6 text-center">
              <p className="text-sm text-muted">
                Create funds with targets on the{" "}
                <a href="/funds" className="text-brand hover:underline">
                  Funds page
                </a>{" "}
                to track goal progress.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
