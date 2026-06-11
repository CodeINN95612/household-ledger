import type { SettlementView } from "@/lib/data";
import type { PersonColor } from "@/lib/person";
import { personClasses } from "@/lib/person";
import { Money } from "@/components/ui/Money";
import { PersonToken } from "@/components/PersonToken";
import { PrivateTag } from "@/components/ui/Badge";

interface Props {
  members: Extract<SettlementView, { status: "ready" }>["members"];
  colorByUser: Map<string, PersonColor>;
  requestingUserId: string;
}

/** Per-person paid / owed / balance, with private income amounts hidden. */
export function BalanceSheet({ members, colorByUser, requestingUserId }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => {
        const color = colorByUser.get(m.userId) ?? "a";
        const isSelf = m.userId === requestingUserId;
        const owed = m.balanceCents > 0;
        return (
          <div
            key={m.userId}
            className={`rounded-[calc(var(--radius)+2px)] border bg-surface p-5 ${personClasses[color].border}/30 border-line`}
          >
            <PersonToken name={m.displayName} color={color} isSelf={isSelf} />

            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label={`Income · ${(m.ratio * 100).toFixed(1)}%`}>
                {m.incomeCents === null ? (
                  <PrivateTag />
                ) : (
                  <Money cents={m.incomeCents} className="text-ink" />
                )}
              </Row>
              <Row label="Paid into shared">
                <Money cents={m.paidCents} className="text-ink" />
              </Row>
              <Row label="Owed (their share)">
                <Money cents={m.owedCents} className="text-ink" />
              </Row>
              <div className="border-t border-line pt-2.5">
                <Row label={owed ? "Is owed back" : m.balanceCents < 0 ? "Owes" : "Settled"}>
                  <Money
                    cents={m.balanceCents}
                    signed
                    className={
                      m.balanceCents > 0
                        ? "font-semibold text-owed"
                        : m.balanceCents < 0
                          ? "font-semibold text-owes"
                          : "text-muted"
                    }
                  />
                </Row>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
