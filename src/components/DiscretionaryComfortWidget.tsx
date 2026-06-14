import type { DiscretionaryComfortResult } from "@/lib/health";
import { formatCents } from "@/lib/money";

interface DiscretionaryComfortWidgetProps {
  comfort: DiscretionaryComfortResult;
  requestingUserId: string;
  displayName: string;
}

const selfReportLabels = {
  overshot: { label: "Overshot", className: "bg-owes-soft text-owes" },
  fine: { label: "On track", className: "bg-brand-soft text-owed" },
  under: { label: "Under budget", className: "bg-brand-soft text-owed" },
} as const;

export function DiscretionaryComfortWidget({
  comfort,
  requestingUserId,
  displayName,
}: DiscretionaryComfortWidgetProps) {
  const planned = comfort.perUserPlannedDiscretionaryCents[requestingUserId];
  const selfReport = comfort.perUserSelfReport[requestingUserId];

  if (planned === undefined) {
    return (
      <p className="text-sm text-faint">Enter income on the statement page to see your discretionary.</p>
    );
  }

  const isNeg = planned < 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular ${isNeg ? "text-owes" : "text-ink"}`}>
          {isNeg ? "−" : ""}{formatCents(Math.abs(planned))}
          <span className="ml-1 text-sm font-normal text-muted">/mo</span>
        </span>
        {selfReport && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${selfReportLabels[selfReport].className}`}
          >
            {selfReportLabels[selfReport].label}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        {displayName}&rsquo;s planned discretionary this month
        {isNeg && (
          <span className="ml-1 text-owes font-medium">— over-allocated, review your funds</span>
        )}
      </p>
    </div>
  );
}
