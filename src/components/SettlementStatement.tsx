import type { SettlementView } from "@/lib/data";
import type { PersonColor } from "@/lib/person";
import { personClasses } from "@/lib/person";
import { Money } from "@/components/ui/Money";

interface Props {
  settlement: SettlementView;
  /** userId → identity color, and userId → display name (members order). */
  colorByUser: Map<string, PersonColor>;
  nameByUser: Map<string, string>;
}

/**
 * The hero: a single confident sentence answering "who pays whom", above a
 * proportional split-bar that makes the income ratio visible (the core concept).
 */
export function SettlementStatement({ settlement, colorByUser, nameByUser }: Props) {
  if (settlement.status === "pending") {
    const names = settlement.missing.map((m) => m.displayName).join(" and ");
    return (
      <Hero eyebrow="Settlement pending">
        <p className="text-2xl font-semibold tracking-tight text-ink">
          Waiting on income from {names}.
        </p>
        <p className="mt-2 text-sm text-muted">
          Shared so far: <Money cents={settlement.totalSharedCents} className="text-ink" />. The
          split is calculated once everyone has entered their income for the month.
        </p>
      </Hero>
    );
  }

  if (settlement.status === "zero-income") {
    return (
      <Hero eyebrow="Settlement pending">
        <p className="text-2xl font-semibold tracking-tight text-ink">
          No income recorded for this month.
        </p>
        <p className="mt-2 text-sm text-muted">
          Enter income above to split{" "}
          <Money cents={settlement.totalSharedCents} className="text-ink" /> in shared costs.
        </p>
      </Hero>
    );
  }

  const transfer = settlement.transfers[0];
  const colorClass = (userId: string) =>
    personClasses[colorByUser.get(userId) ?? "a"].text;
  const nameColorClass = (name: string) => {
    for (const [userId, n] of nameByUser) if (n === name) return colorClass(userId);
    return "text-ink";
  };

  return (
    <Hero eyebrow="Settlement">
      {transfer ? (
        <>
          <p className="text-base text-muted">
            <span className={`font-semibold ${nameColorClass(transfer.fromName)}`}>
              {transfer.fromName}
            </span>{" "}
            sends{" "}
            <span className={`font-semibold ${nameColorClass(transfer.toName)}`}>
              {transfer.toName}
            </span>
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight text-ink">
            <Money cents={transfer.amountCents} />
          </p>
        </>
      ) : (
        <>
          <p className="text-5xl font-semibold tracking-tight text-ink">All settled</p>
          <p className="mt-2 text-sm text-muted">
            Everyone&rsquo;s balance is zero this month. Nothing to transfer.
          </p>
        </>
      )}

      <SplitBar settlement={settlement} colorByUser={colorByUser} />
    </Hero>
  );
}

/** Proportional bar showing each person's income share of the shared pool. */
function SplitBar({
  settlement,
  colorByUser,
}: {
  settlement: Extract<SettlementView, { status: "ready" }>;
  colorByUser: Map<string, PersonColor>;
}) {
  return (
    <div className="mt-6">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
        {settlement.members.map((m) => {
          const color = colorByUser.get(m.userId) ?? "a";
          const pct = Math.max(0, Math.round(m.ratio * 1000) / 10);
          return (
            <div
              key={m.userId}
              className={personClasses[color].dot}
              style={{ width: `${pct}%` }}
              title={`${m.displayName}: ${pct}%`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        {settlement.members.map((m) => {
          const color = colorByUser.get(m.userId) ?? "a";
          return (
            <span key={m.userId} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${personClasses[color].dot}`} />
              {m.displayName} · {(m.ratio * 100).toFixed(1)}%
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Hero({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[calc(var(--radius)+2px)] border border-line bg-surface px-6 py-7">
      <span className="eyebrow">{eyebrow}</span>
      <div className="mt-2">{children}</div>
    </section>
  );
}
