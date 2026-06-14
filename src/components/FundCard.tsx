import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { personClasses, type PersonColor } from "@/lib/person";
import type { FundView } from "@/lib/data";
import { formatMonthKey } from "@/lib/month";

interface FundCardProps {
  fund: FundView;
  /** Person color of the requesting user — used for "personal" scope chip. */
  requestingUserColor: PersonColor;
  /** Projected completion month (from projection engine); not yet wired — pass null. */
  projectedCompletionMonthKey?: string | null;
  /** If true, show edit/archive links. */
  editable?: boolean;
}

/**
 * Fund summary card.
 *
 * Design signature: a 3px top border encodes scope at a glance —
 * brand teal for couple funds, person color for personal. Same quiet
 * device as the StatementCard's left border, but top-oriented here
 * so fund cards read differently from the statement at a glance.
 */
export function FundCard({
  fund,
  requestingUserColor,
  projectedCompletionMonthKey,
  editable = false,
}: FundCardProps) {
  const isCouple = fund.scope === "couple";
  const pc = personClasses[requestingUserColor];

  // Top border color: couple = brand, personal = person color
  const topBorder = isCouple ? "border-t-brand" : pc.border.replace("border-", "border-t-");

  const progressPct =
    fund.targetCents && fund.targetCents > 0
      ? Math.min((fund.currentBalanceCents / fund.targetCents) * 100, 100)
      : null;

  return (
    <div
      className={`rounded-[calc(var(--radius)+2px)] border border-line bg-surface overflow-hidden border-t-[3px] ${topBorder}`}
    >
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/funds/${fund.id}`}
              className="text-base font-semibold text-ink hover:text-brand transition-colors"
            >
              {fund.name}
            </Link>
            <ScopeChip
              scope={fund.scope}
              ownerDisplayName={fund.ownerDisplayName}
              isPrivate={fund.isPrivate}
              requestingUserColor={requestingUserColor}
            />
            {fund.isSinking && (
              <span className="inline-flex items-center rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                Sinking
              </span>
            )}
          </div>
          <span className="tabular text-xl font-semibold text-ink shrink-0">
            <Money cents={fund.currentBalanceCents} />
          </span>
        </div>

        {/* Progress bar */}
        {progressPct !== null && fund.targetCents !== null && (
          <div className="mt-3">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="bg-brand rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
              <span>
                {progressPct.toFixed(0)}% of <Money cents={fund.targetCents} className="text-ink" />
              </span>
              {projectedCompletionMonthKey ? (
                <span className="text-brand font-medium">
                  On track · {formatMonthKey(projectedCompletionMonthKey)}
                </span>
              ) : fund.targetDate ? (
                <span>Target: {formatMonthKey(fund.targetDate.toISOString().slice(0, 7))}</span>
              ) : null}
            </div>
          </div>
        )}

        {/* Allocation rule */}
        {fund.allocationRule && (
          <p className="mt-2 text-xs text-muted">
            Your rule:{" "}
            {fund.allocationRule.fixedCentsOverride !== null ? (
              <span className="font-medium text-ink">
                <Money cents={fund.allocationRule.fixedCentsOverride} /> / month (fixed)
              </span>
            ) : (
              <span className="font-medium text-ink">
                {(fund.allocationRule.percentBps / 100).toFixed(1)}% of income
              </span>
            )}
          </p>
        )}

        {/* Sinking note */}
        {fund.isSinking && fund.sinkingNote && (
          <p className="mt-1 text-xs text-faint">{fund.sinkingNote}</p>
        )}
      </div>

      {/* Edit / Archive footer */}
      {editable && (
        <div className="border-t border-line px-5 py-2.5 flex items-center gap-3">
          <Link
            href={`/funds/${fund.id}`}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            Edit
          </Link>
          <span className="text-faint">·</span>
          <Link
            href={`/funds/${fund.id}#allocation`}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            Set allocation
          </Link>
        </div>
      )}
    </div>
  );
}

function ScopeChip({
  scope,
  ownerDisplayName,
  isPrivate,
  requestingUserColor,
}: {
  scope: "personal" | "couple";
  ownerDisplayName: string | null;
  isPrivate: boolean;
  requestingUserColor: PersonColor;
}) {
  const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

  if (scope === "couple") {
    return <span className={`${pill} bg-brand-soft text-brand`}>Couple</span>;
  }

  const pc = personClasses[requestingUserColor];
  return (
    <span className={`${pill} ${pc.bg} ${pc.text}`}>
      {isPrivate ? "🔒 " : ""}
      {ownerDisplayName ?? "Personal"}
    </span>
  );
}
