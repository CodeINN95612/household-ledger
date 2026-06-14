"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/month-actions";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

export interface ExpenseFormMember {
  id: string;
  displayName: string;
}

export interface ExpenseInitial {
  id: string;
  date: string; // yyyy-mm-dd
  description: string;
  amount: string; // dollars
  type: "shared" | "personal";
  paidByUserId: string;
  category: string | null;
  isRecurringFixed: boolean | null;
}


interface Props {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  members: ExpenseFormMember[];
  defaultPaidByUserId: string;
  submitLabel: string;
  mode: "create" | "edit";
  initial?: ExpenseInitial;
  onDone?: () => void;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const initialState: ActionState = {};

export function ExpenseForm({
  action,
  members,
  defaultPaidByUserId,
  submitLabel,
  mode,
  initial,
  onDone,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [isFinanced, setIsFinanced] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "create") {
      formRef.current?.reset();
      setIsFinanced(false);
    }
    onDone?.();
  }, [state, mode, onDone]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Description" htmlFor="exp-desc">
          <Input
            id="exp-desc"
            name="description"
            placeholder="Groceries"
            defaultValue={initial?.description ?? ""}
            required
          />
        </Field>
        <Field label={isFinanced ? "Total amount" : "Amount"} htmlFor="exp-amount">
          <Input
            id="exp-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={initial?.amount ?? ""}
            required
          />
        </Field>
        <Field label="Date" htmlFor="exp-date">
          <Input id="exp-date" name="date" type="date" defaultValue={initial?.date ?? today()} required />
        </Field>
        <Field label="Paid by" htmlFor="exp-paid">
          <Select id="exp-paid" name="paidByUserId" defaultValue={initial?.paidByUserId ?? defaultPaidByUserId}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Type"
          htmlFor="exp-type"
          hint="Personal expenses are recorded but never split."
        >
          <Select id="exp-type" name="type" defaultValue={initial?.type ?? "shared"}>
            <option value="shared">Shared</option>
            <option value="personal">Personal</option>
          </Select>
        </Field>
        <Field label="Category" htmlFor="exp-category">
          <Select id="exp-category" name="category" defaultValue={initial?.category ?? ""}>
            <option value="">None</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Spending type"
          htmlFor="exp-recurring"
          hint="Affects the shared spend forecast."
        >
          <Select
            id="exp-recurring"
            name="isRecurringFixed"
            defaultValue={
              initial?.isRecurringFixed === true
                ? "true"
                : initial?.isRecurringFixed === false
                  ? "false"
                  : ""
            }
          >
            <option value="">Auto-detect</option>
            <option value="true">Fixed (e.g. rent, subscriptions)</option>
            <option value="false">Variable (e.g. groceries, dining)</option>
          </Select>
        </Field>
      </div>

      {/* Financed toggle — only available when creating */}
      {mode === "create" && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={isFinanced}
              onChange={(e) => setIsFinanced(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong accent-brand"
            />
            Financed (credit card installments)
          </label>

          {isFinanced && (
            <div className="grid gap-3 sm:grid-cols-2 pl-6">
              <Field label="Months" htmlFor="exp-installments">
                <Input
                  id="exp-installments"
                  name="installments"
                  type="number"
                  min="2"
                  max="120"
                  placeholder="12"
                  required
                />
              </Field>
              <Field label="Annual interest %" htmlFor="exp-rate" hint="Leave empty for 0% (interest-free)">
                <Input
                  id="exp-rate"
                  name="annualRate"
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {mode === "edit" ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <span aria-live="polite" className="text-xs">
          {state.error ? <span className="text-owes">{state.error}</span> : null}
        </span>
      </div>
    </form>
  );
}
