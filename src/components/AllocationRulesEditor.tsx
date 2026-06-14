"use client";

import { useTransition } from "react";
import { saveAllocationRuleAction } from "@/app/fund-actions";
import type { FundView } from "@/lib/data";
import { formatCents } from "@/lib/money";

interface RuleRow {
  fundId: string;
  fundName: string;
  percentBps: number;
  fixedCentsOverride: number | null;
}

interface AllocationRulesEditorProps {
  rules: RuleRow[];
  funds: FundView[];
  recentIncomeCents: number;
}

export function AllocationRulesEditor({
  rules,
  funds,
  recentIncomeCents,
}: AllocationRulesEditorProps) {
  const [, startTransition] = useTransition();

  const totalBps = rules.reduce((s, r) => s + (r.fixedCentsOverride === null ? r.percentBps : 0), 0);
  const totalFixed = rules.reduce((s, r) => s + (r.fixedCentsOverride ?? 0), 0);

  function estimate(rule: RuleRow): number {
    if (rule.fixedCentsOverride !== null) return rule.fixedCentsOverride;
    return Math.floor((rule.percentBps / 10000) * recentIncomeCents);
  }

  function handlePercentChange(fundId: string, value: string) {
    const pct = parseFloat(value);
    if (isNaN(pct) || pct < 0) return;
    startTransition(async () => { await saveAllocationRuleAction(fundId, Math.round(pct * 100), null); });
  }

  if (rules.length === 0 && funds.filter((f) => f.scope === "couple").length === 0) {
    return (
      <p className="text-sm text-faint">
        Create couple funds to set up allocation rules.
      </p>
    );
  }

  const coupleFunds = funds.filter((f) => f.scope === "couple");

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-4 text-left font-medium text-muted">Fund</th>
              <th className="py-2 px-3 text-right font-medium text-muted">% income</th>
              <th className="py-2 px-3 text-right font-medium text-muted">Est. /mo</th>
              <th className="py-2 pl-3 text-right font-medium text-muted"></th>
            </tr>
          </thead>
          <tbody>
            {coupleFunds.map((f) => {
              const rule = rules.find((r) => r.fundId === f.id);
              const pct = rule
                ? rule.fixedCentsOverride !== null
                  ? null
                  : rule.percentBps / 100
                : null;
              const estCents = rule ? estimate(rule) : 0;
              return (
                <tr key={f.id} className="border-b border-line/50 last:border-0">
                  <td className="py-2 pr-4 text-ink">
                    <a href={`/funds/${f.id}`} className="hover:text-brand transition-colors">
                      {f.name}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {rule?.fixedCentsOverride !== null && rule?.fixedCentsOverride !== undefined ? (
                      <span className="text-muted text-xs">
                        fixed {formatCents(rule.fixedCentsOverride)}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={pct !== null ? pct.toFixed(1) : ""}
                        placeholder="0.0"
                        onBlur={(e) => handlePercentChange(f.id, e.target.value)}
                        className="w-16 rounded border border-line bg-paper px-2 py-1 text-right text-sm tabular focus:border-brand focus:outline-none"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-muted tabular text-sm">
                    {rule && recentIncomeCents > 0 ? formatCents(estCents) : "—"}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <a href={`/funds/${f.id}`} className="text-xs text-faint hover:text-brand transition-colors">
                      Edit →
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-muted">Total allocation</span>
        <div className="flex items-center gap-3 tabular">
          <span className={totalBps > 10000 ? "text-owes font-medium" : "text-ink"}>
            {(totalBps / 100).toFixed(1)}%
          </span>
          {recentIncomeCents > 0 && (
            <span className="text-muted">
              {formatCents(totalFixed + Math.floor((totalBps / 10000) * recentIncomeCents))}/mo
            </span>
          )}
        </div>
      </div>
      {totalBps > 10000 && (
        <p className="text-xs text-owes">Total exceeds 100% — your discretionary will be negative.</p>
      )}
    </div>
  );
}
