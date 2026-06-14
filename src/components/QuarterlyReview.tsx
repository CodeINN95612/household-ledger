import type { ReviewSummaryData } from "@/lib/data";
import { AdherenceRow } from "./AdherenceRow";
import { formatCents } from "@/lib/money";
import { formatMonthKey } from "@/lib/month";

interface QuarterlyReviewProps {
  summary: ReviewSummaryData;
}

function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(1)}%`;
}

export function QuarterlyReview({ summary }: QuarterlyReviewProps) {
  const rateDelta =
    summary.savingsRateBps !== null && summary.priorSavingsRateBps !== null
      ? summary.savingsRateBps - summary.priorSavingsRateBps
      : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Savings rate</p>
          <p className="text-xl font-semibold text-ink tabular">
            {formatBps(summary.savingsRateBps)}
          </p>
          {rateDelta !== null && (
            <p className={`text-xs mt-1 tabular ${rateDelta >= 0 ? "text-owed" : "text-owes"}`}>
              {rateDelta >= 0 ? "+" : ""}{formatBps(rateDelta)} vs prior
            </p>
          )}
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Total saved</p>
          <p className="text-xl font-semibold text-ink tabular">
            {formatCents(summary.totalSavedCents)}
          </p>
          <p className="text-xs mt-1 text-faint">
            of {formatCents(summary.totalIncomeCents)} income
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Shared spend</p>
          <p className="text-xl font-semibold text-ink tabular">
            {formatCents(summary.totalSharedSpendCents)}
          </p>
          <p className="text-xs mt-1 text-faint">
            {summary.monthKeys.length} months
          </p>
        </div>
      </div>

      {/* Adherence table */}
      {summary.adherence.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Allocation adherence</p>
          <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2">
            {summary.adherence.map((row) => (
              <AdherenceRow key={row.fundId} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* Anomaly log */}
      {summary.anomalyMonths.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Variable spend spikes</p>
          <div className="flex flex-col gap-2">
            {summary.anomalyMonths.map((a) => (
              <div
                key={a.monthKey}
                className="flex items-center justify-between rounded-[var(--radius)] border border-owes/20 bg-owes-soft px-4 py-2.5 text-sm"
              >
                <span className="text-muted">{formatMonthKey(a.monthKey)}</span>
                <span className="font-medium text-owes tabular">+{a.variablePct}% above avg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.adherence.length === 0 && summary.anomalyMonths.length === 0 && (
        <p className="text-sm text-faint text-center py-4">
          No allocation rules or spending data for this period.
        </p>
      )}
    </div>
  );
}
