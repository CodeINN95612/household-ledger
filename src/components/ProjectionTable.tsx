import type { ProjectedMonth, FundCompletion } from "@/lib/projection";
import type { ProjectionUserData } from "@/lib/data";
import type { FundView } from "@/lib/data";
import { formatCents } from "@/lib/money";

interface ProjectionTableProps {
  months: ProjectedMonth[];
  users: ProjectionUserData[];
  funds: FundView[];
  fundCompletions: FundCompletion[];
}

function shortMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function rowOpacity(index: number, total: number): number {
  if (total <= 6) return 1;
  const t = index / (total - 1);
  return 1 - t * 0.28; // fades to ~0.72 at last row
}

export function ProjectionTable({ months, users, funds, fundCompletions }: ProjectionTableProps) {
  if (months.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No projection data. Enter your income to get started.
      </p>
    );
  }

  // Map fundId → target progress at the end of the horizon
  const completionByFund = new Map(fundCompletions.map((c) => [c.fundId, c]));

  // Only show funds that have at least one user with an allocation rule
  const visibleFundIds = new Set(
    users.flatMap((u) => u.allocationRules.map((r) => r.fundId)),
  );
  const visibleFunds = funds.filter((f) => visibleFundIds.has(f.id));

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-4 text-left font-medium text-muted w-20">Month</th>
            {users.map((u) => (
              <th key={u.userId} className="py-2 px-3 text-right font-medium text-muted whitespace-nowrap">
                {u.displayName.split(" ")[0]}
                <span className="block text-[10px] font-normal text-faint">disc.</span>
              </th>
            ))}
            {visibleFunds.map((f) => {
              const completion = completionByFund.get(f.id);
              const endBalance = completion?.finalBalanceCents ?? 0;
              const pct = f.targetCents && f.targetCents > 0
                ? Math.min(100, Math.round((endBalance / f.targetCents) * 100))
                : null;
              return (
                <th key={f.id} className="py-2 px-3 text-right font-medium text-muted whitespace-nowrap">
                  <span className="block truncate max-w-24">{f.name}</span>
                  {pct !== null && (
                    <span className="block text-[10px] font-normal text-faint">{pct}% by end</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {months.map((month, i) => {
            const opacity = rowOpacity(i, months.length);
            return (
              <tr
                key={month.monthKey}
                style={{ opacity }}
                className={`border-b border-line/50 ${i % 2 === 0 ? "" : "bg-paper/60"}`}
              >
                <td className="py-2 pr-4 text-sm text-muted tabular whitespace-nowrap">
                  {shortMonth(month.monthKey)}
                </td>
                {month.users.map((u) => {
                  const isNeg = u.discretionaryCents < 0;
                  return (
                    <td
                      key={u.userId}
                      className={`py-2 px-3 text-right tabular whitespace-nowrap rounded-sm ${
                        isNeg ? "bg-owes-soft text-owes" : "text-ink"
                      }`}
                    >
                      {isNeg ? "−" : ""}
                      {formatCents(Math.abs(u.discretionaryCents))}
                    </td>
                  );
                })}
                {visibleFunds.map((f) => {
                  const fundSlice = month.funds.find((fs) => fs.fundId === f.id);
                  const balance = fundSlice?.balanceCents ?? 0;
                  const reached = fundSlice?.targetReached ?? false;
                  return (
                    <td
                      key={f.id}
                      className={`py-2 px-3 text-right tabular whitespace-nowrap ${
                        reached ? "text-owed font-medium" : "text-muted"
                      }`}
                    >
                      {formatCents(balance)}
                      {reached && <span className="ml-1 text-[10px]">✓</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
