"use client";

import type { FundView } from "@/lib/data";
import { archiveFundAction } from "@/app/fund-actions";
import { formatCents } from "@/lib/money";

interface FundManagerSectionProps {
  funds: FundView[];
  requestingUserId: string;
}

export function FundManagerSection({ funds, requestingUserId }: FundManagerSectionProps) {
  if (funds.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted">No funds yet.</p>
        <a href="/funds/new" className="mt-2 inline-block text-sm text-brand hover:underline">
          Create your first fund →
        </a>
      </div>
    );
  }

  const coupleFunds = funds.filter((f) => f.scope === "couple");
  const personalFunds = funds.filter((f) => f.scope === "personal" && f.ownerUserId === requestingUserId);

  return (
    <div className="flex flex-col gap-5">
      {coupleFunds.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Couple funds</p>
          <FundTable funds={coupleFunds} requestingUserId={requestingUserId} />
        </div>
      )}
      {personalFunds.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Your personal funds</p>
          <FundTable funds={personalFunds} requestingUserId={requestingUserId} />
        </div>
      )}
      <a
        href="/funds/new"
        className="inline-flex items-center gap-1.5 self-start rounded-[var(--radius)] border border-dashed border-line px-4 py-2 text-sm text-muted hover:border-brand hover:text-brand transition-colors"
      >
        + New fund
      </a>
    </div>
  );
}

function FundTable({ funds, requestingUserId }: { funds: FundView[]; requestingUserId: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface overflow-hidden">
      {funds.map((f) => (
        <div key={f.id} className="flex items-center gap-4 border-b border-line/50 last:border-0 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{f.name}</p>
            <p className="text-xs text-muted tabular">
              {formatCents(f.currentBalanceCents)}
              {f.targetCents ? ` / ${formatCents(f.targetCents)}` : ""}
              {f.isPrivate && <span className="ml-1.5 text-faint">· private</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/funds/${f.id}`}
              className="rounded px-2.5 py-1 text-xs text-muted hover:bg-line/60 hover:text-ink transition-colors"
            >
              Edit
            </a>
            {(f.scope === "couple" || f.ownerUserId === requestingUserId) && (
              <form action={archiveFundAction.bind(null, f.id)}>
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm(`Archive "${f.name}"? It will no longer appear in the fund list.`))
                      e.preventDefault();
                  }}
                  className="rounded px-2.5 py-1 text-xs text-muted hover:bg-owes-soft hover:text-owes transition-colors"
                >
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
