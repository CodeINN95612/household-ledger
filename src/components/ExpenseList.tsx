import type { ExpenseView } from "@/lib/data";
import type { PersonColor } from "@/lib/person";
import { Money } from "@/components/ui/Money";
import { ExpenseRow } from "@/components/ExpenseRow";
import type { ExpenseFormMember } from "@/components/ExpenseForm";

interface Props {
  expenses: ExpenseView[];
  members: ExpenseFormMember[];
  colorByUser: Map<string, PersonColor>;
  defaultPaidByUserId: string;
}

export function ExpenseList({ expenses, members, colorByUser, defaultPaidByUserId }: Props) {
  if (expenses.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted">
        No expenses yet this month. Add the first one above.
      </p>
    );
  }

  const sharedTotal = expenses
    .filter((e) => e.type === "shared")
    .reduce((acc, e) => acc + e.amountCents, 0);

  return (
    <div>
      <ul>
        {expenses.map((e) => (
          <ExpenseRow
            key={e.id}
            expense={e}
            members={members}
            paidByColor={colorByUser.get(e.paidByUserId) ?? "a"}
            defaultPaidByUserId={defaultPaidByUserId}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
        <span className="text-muted">Shared total</span>
        <Money cents={sharedTotal} className="font-semibold text-ink" />
      </div>
    </div>
  );
}
