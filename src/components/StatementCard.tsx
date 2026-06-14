import { Money } from "@/components/ui/Money";
import { PersonToken } from "@/components/PersonToken";
import { StatementLine, StatementLineHeader } from "@/components/StatementLine";
import { EstimatedBadge } from "@/components/EstimatedBadge";
import { FloatPanel } from "@/components/FloatPanel";
import type { PersonColor } from "@/lib/person";
import { personClasses } from "@/lib/person";
import type { StatementResult } from "@/lib/statement";

interface StatementCardProps {
  statement: StatementResult;
  displayName: string;
  personColor: PersonColor;
  monthLabel: string;
  /** Show float panel; null = not the fronting partner */
  floatData: { outstandingCents: number; recommendedReserveCents: number } | null;
}

/**
 * The per-person monthly statement.
 *
 * Signature element: a 3px left border in the person's identity color — a quiet
 * signal that this ledger belongs to you specifically.
 */
export function StatementCard({
  statement,
  displayName,
  personColor,
  monthLabel,
  floatData,
}: StatementCardProps) {
  const c = personClasses[personColor];
  const {
    incomeCents,
    allocationLines,
    sharedOwedCents,
    sharedIsEstimated,
    discretionaryPlannedCents,
    discretionaryActualCents,
    isOverAllocated,
    floatReserveCents,
  } = statement;

  const hasAllocations = allocationLines.length > 0;
  const discretionaryFinal = discretionaryActualCents ?? discretionaryPlannedCents;
  const discretionaryPositive = discretionaryFinal >= 0;

  return (
    <div>
      {/* The card — left border in person color is the design signature */}
      <section
        className={`rounded-[calc(var(--radius)+2px)] border border-line bg-surface overflow-hidden border-l-[3px] ${c.border}`}
      >
        {/* Header */}
        <header className="border-b border-line px-5 py-4">
          <span className="eyebrow">{monthLabel}</span>
          <div className="mt-1.5">
            <PersonToken name={displayName} color={personColor} isSelf />
          </div>
        </header>

        <div className="px-5 py-4 space-y-0">
          {/* Income row */}
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm font-medium text-ink">Income</span>
            <span className="tabular text-base font-semibold text-ink">
              <Money cents={incomeCents} />
            </span>
          </div>

          {/* Allocations */}
          {hasAllocations && (
            <>
              <div className="border-t border-line pt-3 pb-0.5">
                <StatementLineHeader />
              </div>
              {allocationLines.map((line) => (
                <StatementLine
                  key={line.fundId}
                  label={line.fundName}
                  plannedCents={line.plannedCents}
                  actualCents={line.actualCents}
                  deduction
                />
              ))}
            </>
          )}

          {/* Shared living */}
          <div className={`${hasAllocations ? "" : "border-t border-line pt-3"}`}>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex items-center gap-1.5 text-sm text-muted">
                Shared living
                {sharedIsEstimated && (
                  <span className="ml-1">
                    <EstimatedBadge />
                  </span>
                )}
              </span>
              <span className="tabular text-sm text-ink">
                −<Money cents={sharedOwedCents} />
              </span>
            </div>
          </div>

          {/* Float reserve note (fronting partner only) — shown inline, not subtracted */}
          {floatReserveCents > 0 && (
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-xs text-faint italic">Float reserve (carved out)</span>
              <span className="tabular text-xs text-faint">
                <Money cents={floatReserveCents} />
              </span>
            </div>
          )}

          {/* Over-allocation warning */}
          {isOverAllocated && (
            <div className="mt-2 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-700">
                Your allocations exceed your income for this month.
              </p>
            </div>
          )}

          {/* Divider + Discretionary hero */}
          <div className="border-t-2 border-ink/10 pt-3 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow mb-0.5">Yours</p>
                <p className="text-xs text-muted">
                  {discretionaryActualCents !== null ? "After actual contributions" : "Planned"}
                </p>
              </div>
              <span
                className={`tabular text-3xl font-semibold tracking-tight ${
                  discretionaryPositive ? "text-owed" : "text-owes"
                }`}
              >
                {discretionaryFinal < 0 ? "−" : ""}
                <Money cents={Math.abs(discretionaryFinal)} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Float panel — below the card, fronting partner only */}
      {floatData && (
        <FloatPanel
          outstandingCents={floatData.outstandingCents}
          recommendedReserveCents={floatData.recommendedReserveCents}
        />
      )}
    </div>
  );
}
