"use client";

import { useState, useTransition } from "react";
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
import { updateExpenseAction, deleteExpenseAction, tagExpenseAction, cancelFinancedExpenseAction } from "@/app/month-actions";
import { centsToInputValue } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

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

function nextRecurringState(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

function recurringLabel(v: boolean | null): string {
  if (v === true) return "Fixed";
  if (v === false) return "Variable";
  return "";
}

export function ExpenseRow({ expense, members, paidByColor, defaultPaidByUserId }: Props) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function tag(updates: { category?: string | null; isRecurringFixed?: boolean | null }) {
    const fd = new FormData();
    fd.set("id", expense.id);
    fd.set("category", updates.category ?? expense.category ?? "");
    const rf = updates.isRecurringFixed !== undefined
      ? updates.isRecurringFixed
      : expense.isRecurringFixed;
    fd.set("isRecurringFixed", rf === null ? "" : String(rf));
    startTransition(() => tagExpenseAction(fd));
  }

  if (editing) {
    const initial: ExpenseInitial = {
      id: expense.id,
      date: expense.date.slice(0, 10),
      description: expense.description,
      amount: centsToInputValue(expense.amountCents),
      type: expense.type,
      paidByUserId: expense.paidByUserId,
      category: expense.category,
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

  const showTags = expense.type === "shared";

  return (
    <li className="flex items-start gap-4 border-b border-line px-5 py-3 last:border-0">
      <span className="mt-0.5 w-12 shrink-0 text-xs text-faint tabular">{shortDate(expense.date)}</span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{expense.description}</span>
          <TypeBadge type={expense.type} />
          {expense.financed && (
            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand tabular">
              {expense.financed.installmentNum}/{expense.financed.totalInstallments}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${personClasses[paidByColor].dot}`} />
            {expense.paidByName}
          </span>

          {/* Category badge / selector */}
          {showTags && (
            <span className="flex items-center gap-1">
              {expense.category ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand capitalize">
                  {expense.category}
                  <button
                    type="button"
                    onClick={() => tag({ category: null })}
                    className="text-faint hover:text-muted leading-none"
                    title="Remove category"
                  >
                    ×
                  </button>
                </span>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) tag({ category: e.target.value });
                  }}
                  className="rounded border-0 bg-transparent text-[10px] text-faint hover:text-muted cursor-pointer focus:outline-none"
                  title="Add category"
                >
                  <option value="">+ tag</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </span>
          )}

          {/* Recurring toggle */}
          {showTags && (
            <button
              type="button"
              onClick={() => tag({ isRecurringFixed: nextRecurringState(expense.isRecurringFixed) })}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                expense.isRecurringFixed === true
                  ? "bg-brand-soft text-brand"
                  : expense.isRecurringFixed === false
                    ? "bg-line text-muted"
                    : "text-faint hover:text-muted"
              }`}
              title="Toggle fixed/variable"
            >
              {recurringLabel(expense.isRecurringFixed) || "↻"}
            </button>
          )}
        </div>
      </div>

      <Money cents={expense.amountCents} className="mt-0.5 text-sm text-ink shrink-0" />

      <div className="flex shrink-0 items-center gap-1 mt-0.5">
        {expense.financed ? (
          <form
            action={cancelFinancedExpenseAction}
            onSubmit={(e) => {
              const remaining = expense.financed!.totalInstallments - expense.financed!.installmentNum;
              if (
                !confirm(
                  `Cancel "${expense.description}"? This will stop ${remaining} remaining payment${remaining === 1 ? "" : "s"}.`,
                )
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={expense.financed.financedExpenseId} />
            <button
              type="submit"
              className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-owes-soft hover:text-owes"
            >
              Cancel plan
            </button>
          </form>
        ) : (
          <>
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
          </>
        )}
      </div>
    </li>
  );
}
