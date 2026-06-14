import type { FundCompletion } from "@/lib/projection";
import type { FundView } from "@/lib/data";
import { formatMonthKey } from "@/lib/month";
import { formatCents } from "@/lib/money";

interface FundCompletionListProps {
  completions: FundCompletion[];
  horizonMonths: number;
  funds: FundView[];
}

export function FundCompletionList({ completions, horizonMonths, funds }: FundCompletionListProps) {
  const fundsWithTargets = completions.filter((c) => {
    const fund = funds.find((f) => f.id === c.fundId);
    return fund?.targetCents !== null && fund?.targetCents !== undefined;
  });

  if (fundsWithTargets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {fundsWithTargets.map((c) => {
        const fund = funds.find((f) => f.id === c.fundId);
        const pct = fund?.targetCents
          ? Math.min(100, Math.round((c.finalBalanceCents / fund.targetCents) * 100))
          : 0;
        const reached = c.completionMonthKey !== null;

        return (
          <div
            key={c.fundId}
            className={`flex items-center justify-between gap-4 rounded-[var(--radius)] border px-4 py-3 ${
              reached ? "border-owed/30 bg-brand-soft" : "border-line bg-surface"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {reached ? (
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-owed/20 text-owed text-xs font-bold">
                  ✓
                </span>
              ) : (
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-line text-faint text-xs">
                  {pct}%
                </span>
              )}
              <div className="min-w-0">
                <p className="font-medium text-ink text-sm truncate">{c.fundName}</p>
                <p className="text-xs text-muted">
                  {formatCents(c.finalBalanceCents)}
                  {fund?.targetCents ? ` / ${formatCents(fund.targetCents)}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {reached ? (
                <p className="text-sm font-semibold text-owed">
                  {formatMonthKey(c.completionMonthKey!)}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Not reached in {horizonMonths}mo
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
