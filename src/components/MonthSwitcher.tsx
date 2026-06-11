import Link from "next/link";
import { formatMonthKey, shiftMonthKey, currentMonthKey } from "@/lib/month";

/** Prev / current-month-label / next navigation for the dashboard. */
export function MonthSwitcher({ monthKey }: { monthKey: string }) {
  const prev = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);
  const isCurrent = monthKey === currentMonthKey();

  return (
    <div className="flex items-center gap-1">
      <ArrowLink href={`/month/${prev}`} label="Previous month" dir="prev" />
      <div className="min-w-[9rem] text-center">
        <span className="text-lg font-semibold tracking-tight">{formatMonthKey(monthKey)}</span>
        {isCurrent ? <span className="ml-2 text-xs text-faint">current</span> : null}
      </div>
      <ArrowLink href={`/month/${next}`} label="Next month" dir="next" />
    </div>
  );
}

function ArrowLink({ href, label, dir }: { href: string; label: string; dir: "prev" | "next" }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-muted transition-colors hover:bg-line/60 hover:text-ink"
    >
      {dir === "prev" ? "‹" : "›"}
    </Link>
  );
}
