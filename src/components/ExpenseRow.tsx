"use client";

import { useState } from "react";
import type { ExpenseView } from "@/lib/data";
import type { PersonColor } from "@/lib/person";
import { personClasses } from "@/lib/person";
import { Money } from "@/components/ui/Money";
import { TypeBadge } from "@/components/ui/Badge";
import {
  ExpenseForm,
  type ExpenseFormMember,
  type ExpenseInitial,
} from "@/components/ExpenseForm";
import { updateExpenseAction, deleteExpenseAction } from "@/app/month-actions";
import { centsToInputValue } from "@/lib/money";

interface Props {
  expense: ExpenseView;
  members: ExpenseFormMember[];
  paidByColor: PersonColor;
  defaultPaidByUserId: string;
}

function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(2000, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ExpenseRow({ expense, members, paidByColor, defaultPaidByUserId }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const initial: ExpenseInitial = {
      id: expense.id,
      date: expense.date.slice(0, 10),
      description: expense.description,
      amount: centsToInputValue(expense.amountCents),
      type: expense.type,
      paidByUserId: expense.paidByUserId,
    };
    return (
      <li className="border-b border-line px-5 py-4 last:border-0">
        <ExpenseForm
          action={updateExpenseAction}
          members={members}
          defaultPaidByUserId={defaultPaidByUserId}
          submitLabel="Save changes"
          mode="edit"
          initial={initial}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
      <span className="w-12 shrink-0 text-xs text-faint tabular">{shortDate(expense.date)}</span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{expense.description}</span>
          <TypeBadge type={expense.type} />
        </div>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${personClasses[paidByColor].dot}`} />
          {expense.paidByName}
        </span>
      </div>

      <Money cents={expense.amountCents} className="text-sm text-ink" />

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-line/60 hover:text-ink"
        >
          Edit
        </button>
        <form
          action={deleteExpenseAction}
          onSubmit={(e) => {
            if (!confirm(`Delete "${expense.description}"?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={expense.id} />
          <button
            type="submit"
            className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-owes-soft hover:text-owes"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}
