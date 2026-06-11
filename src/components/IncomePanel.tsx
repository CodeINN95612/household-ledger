import type { IncomeView } from "@/lib/data";
import type { PersonColor } from "@/lib/person";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PersonToken } from "@/components/PersonToken";
import { PrivateTag } from "@/components/ui/Badge";
import { IncomeForm } from "@/components/IncomeForm";
import { centsToInputValue } from "@/lib/money";

interface Props {
  monthKey: string;
  incomes: IncomeView[];
  colorByUser: Map<string, PersonColor>;
}

/** Shows both partners' income state; only the self row is editable. */
export function IncomePanel({ monthKey, incomes, colorByUser }: Props) {
  const self = incomes.find((i) => i.isSelf);
  const others = incomes.filter((i) => !i.isSelf);

  return (
    <Card eyebrow="Income" title="This month">
      <div className="flex flex-col gap-5">
        {self ? (
          <IncomeForm
            monthKey={monthKey}
            initialAmount={
              self.entered && self.amountCents !== null
                ? centsToInputValue(self.amountCents)
                : ""
            }
            initialPrivate={self.isPrivate}
          />
        ) : null}

        {others.map((o) => (
          <div
            key={o.userId}
            className="flex items-center justify-between border-t border-line pt-4"
          >
            <PersonToken name={o.displayName} color={colorByUser.get(o.userId) ?? "b"} />
            <span className="text-sm">
              {!o.entered ? (
                <span className="text-faint">Not entered yet</span>
              ) : o.amountCents === null ? (
                <PrivateTag />
              ) : (
                <Money cents={o.amountCents} className="text-ink" />
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
