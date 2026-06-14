import type { AdherenceFundRow } from "@/lib/data";
import { AdherenceBadge } from "./AdherenceBadge";
import { formatCents } from "@/lib/money";

interface AdherenceRowProps {
  row: AdherenceFundRow;
}

export function AdherenceRow({ row }: AdherenceRowProps) {
  const pct =
    row.plannedCents > 0
      ? Math.min(100, Math.round((row.actualCents / row.plannedCents) * 100))
      : 100;

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-line/50 last:border-0">
      <AdherenceBadge status={row.status} />
      <span className="flex-1 min-w-0 truncate text-sm text-ink">{row.fundName}</span>
      <div className="flex items-center gap-3 shrink-0 text-sm tabular">
        <span className="text-muted w-20 text-right">{formatCents(row.actualCents)}</span>
        <span className="text-faint">/ {formatCents(row.plannedCents)}</span>
        <span
          className={`w-10 text-right font-medium ${
            row.status === "hit" ? "text-owed" : row.status === "partial" ? "text-[#c59b3a]" : "text-owes"
          }`}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
