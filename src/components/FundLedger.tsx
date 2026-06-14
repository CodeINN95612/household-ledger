import { Money } from "@/components/ui/Money";
import type { FundDetailView } from "@/lib/data";

type Entry = FundDetailView["entries"][number];

const kindLabel: Record<Entry["kind"], string> = {
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  adjustment: "Adjustment",
};

const kindClass: Record<Entry["kind"], string> = {
  contribution: "bg-brand-soft text-brand",
  withdrawal: "bg-owes-soft text-owes",
  adjustment: "bg-line text-muted",
};

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

interface FundLedgerProps {
  entries: Entry[];
}

/** Chronological ledger of all FundEntry rows for a fund. */
export function FundLedger({ entries }: FundLedgerProps) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-faint">
        No entries yet. Contributions will appear here after the monthly sweep.
      </p>
    );
  }

  const runningTotal = entries.reduce((s, e) => s + e.amountCents, 0);

  return (
    <div>
      <div className="divide-y divide-line">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`${pill} ${kindClass[e.kind]} shrink-0`}>
                {kindLabel[e.kind]}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{e.monthKey}</p>
                {e.note && <p className="text-xs text-muted truncate">{e.note}</p>}
                <p className="text-xs text-faint">{e.userName}</p>
              </div>
            </div>
            <span
              className={`tabular text-sm font-medium shrink-0 ${
                e.amountCents >= 0 ? "text-owed" : "text-owes"
              }`}
            >
              {e.amountCents >= 0 ? "+" : ""}
              <Money cents={Math.abs(e.amountCents)} />
              {e.amountCents < 0 ? " (−)" : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Running total */}
      <div className="border-t-2 border-ink/10 mt-1 pt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">Balance</span>
        <span
          className={`tabular text-base font-semibold ${
            runningTotal >= 0 ? "text-ink" : "text-owes"
          }`}
        >
          <Money cents={runningTotal} />
        </span>
      </div>
    </div>
  );
}
