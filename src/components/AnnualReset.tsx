import type { ReviewSummaryData } from "@/lib/data";
import { AdherenceRow } from "./AdherenceRow";
import { formatCents } from "@/lib/money";

interface AnnualResetProps {
  summary: ReviewSummaryData;
}

function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(1)}%`;
}

export function AnnualReset({ summary }: AnnualResetProps) {
  const hitCount = summary.adherence.filter((r) => r.status === "hit").length;
  const total = summary.adherence.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Year totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Savings rate</p>
          <p className="text-xl font-semibold text-ink tabular">{formatBps(summary.savingsRateBps)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Total saved</p>
          <p className="text-xl font-semibold text-ink tabular">{formatCents(summary.totalSavedCents)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Total income</p>
          <p className="text-xl font-semibold text-ink tabular">{formatCents(summary.totalIncomeCents)}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-1">Shared spend</p>
          <p className="text-xl font-semibold text-ink tabular">{formatCents(summary.totalSharedSpendCents)}</p>
        </div>
      </div>

      {/* Adherence summary */}
      {total > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="eyebrow">Year adherence</p>
            <span className="text-sm text-muted tabular">
              {hitCount}/{total} funds on track
            </span>
          </div>
          <div className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2">
            {summary.adherence.map((row) => (
              <AdherenceRow key={row.fundId} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* Re-baseline prompt */}
      <div className="rounded-[var(--radius)] border border-dashed border-brand/40 bg-brand-soft/30 px-5 py-4">
        <p className="text-sm font-medium text-ink mb-1">Ready for next year?</p>
        <p className="text-sm text-muted mb-3">
          Review your allocation rules to reflect changes in income or goals.
          {total > 0 && hitCount < total && (
            <span className="text-owes ml-1">
              {total - hitCount} fund{total - hitCount > 1 ? "s" : ""} missed target this year —
              consider adjusting the %.
            </span>
          )}
        </p>
        <a
          href="/funds"
          className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Review allocation rules →
        </a>
      </div>
    </div>
  );
}
