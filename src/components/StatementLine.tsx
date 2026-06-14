import { Money } from "@/components/ui/Money";

interface StatementLineProps {
  label: string;
  plannedCents: number;
  /** null = not yet recorded this month */
  actualCents: number | null;
  /** Render the line as a deduction (−) */
  deduction?: boolean;
  /** Extra node appended to the label (e.g. EstimatedBadge) */
  labelSuffix?: React.ReactNode;
}

/**
 * One allocation row in the personal statement.
 * Left: label (+ optional suffix). Right: planned and actual columns.
 */
export function StatementLine({
  label,
  plannedCents,
  actualCents,
  deduction = false,
  labelSuffix,
}: StatementLineProps) {
  const sign = deduction ? "−" : "";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-1.5 text-sm text-muted">
        {label}
        {labelSuffix}
      </span>
      <div className="flex items-center gap-4">
        {/* Planned */}
        <span className="tabular text-sm text-ink">
          {sign}
          <Money cents={plannedCents} />
        </span>
        {/* Actual */}
        <span className="tabular w-20 text-right text-sm">
          {actualCents !== null ? (
            <Money
              cents={actualCents}
              className={actualCents < plannedCents ? "text-owes" : "text-muted"}
            />
          ) : (
            <span className="text-faint">—</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Column headers for the planned / actual pair. */
export function StatementLineHeader() {
  return (
    <div className="flex items-center justify-between gap-3 pb-1">
      <span className="eyebrow">Allocation</span>
      <div className="flex items-center gap-4">
        <span className="eyebrow w-20 text-right">Plan</span>
        <span className="eyebrow w-20 text-right">Actual</span>
      </div>
    </div>
  );
}
