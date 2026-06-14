import { Money } from "@/components/ui/Money";

interface FloatPanelProps {
  outstandingCents: number;
  recommendedReserveCents: number;
}

/**
 * Compact float-reserve panel for the fronting partner.
 * Shows how much is currently out-of-pocket and the recommended reserve to
 * mentally set aside. Informational only — not subtracted from discretionary.
 */
export function FloatPanel({ outstandingCents, recommendedReserveCents }: FloatPanelProps) {
  return (
    <aside
      className="mt-3 rounded-[var(--radius)] border border-line bg-paper px-4 py-3"
      aria-label="Float reserve"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Float reserve</p>
          <p className="text-xs text-muted leading-relaxed">
            Money you've fronted that hasn't come back yet.
            <br />
            Carved out of your cash — not subtracted above.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-faint mb-0.5">Outstanding</p>
          <p className="tabular text-base font-semibold text-ink">
            <Money cents={outstandingCents} />
          </p>
        </div>
      </div>
      {recommendedReserveCents > 0 && (
        <div className="mt-2.5 border-t border-line pt-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Recommended reserve</span>
          <span className="tabular text-sm font-medium text-ink">
            <Money cents={recommendedReserveCents} />
          </span>
        </div>
      )}
    </aside>
  );
}
