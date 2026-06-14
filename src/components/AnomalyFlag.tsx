"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

interface AnomalyFlagProps {
  currentVariableCents: number;
  avgPrior6VariableCents: number;
}

export function AnomalyFlag({ currentVariableCents, avgPrior6VariableCents }: AnomalyFlagProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const pct = Math.round(((currentVariableCents - avgPrior6VariableCents) / avgPrior6VariableCents) * 100);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-owes/30 bg-owes-soft px-4 py-3 text-sm">
      <p className="text-owes">
        <span className="font-semibold">Variable spend is {pct}% above your 6-month average</span>
        {" "}—{" "}
        <span className="tabular">{formatCents(currentVariableCents)}</span> this month vs{" "}
        <span className="tabular">{formatCents(avgPrior6VariableCents)}</span> avg
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-owes/60 hover:text-owes transition-colors"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
