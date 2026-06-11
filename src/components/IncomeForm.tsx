"use client";

import { useActionState } from "react";
import { saveIncomeAction, type ActionState } from "@/app/month-actions";
import { Field, Input, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Props {
  monthKey: string;
  initialAmount: string; // dollars, e.g. "3000.00" or ""
  initialPrivate: boolean;
}

const initialState: ActionState = {};

/** The requesting user edits their OWN income for the month here. */
export function IncomeForm({ monthKey, initialAmount, initialPrivate }: Props) {
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="monthKey" value={monthKey} />
      <Field label="Your income this month" htmlFor="income-amount">
        <Input
          id="income-amount"
          name="amount"
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={initialAmount}
          aria-describedby="income-status"
        />
      </Field>
      <Checkbox
        name="isPrivate"
        defaultChecked={initialPrivate}
        label="Keep this amount private"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save income"}
        </Button>
        <span id="income-status" aria-live="polite" className="text-xs">
          {state.error ? (
            <span className="text-owes">{state.error}</span>
          ) : state.ok ? (
            <span className="text-brand">Saved.</span>
          ) : null}
        </span>
      </div>
      <p className="text-xs text-faint">
        Private hides the amount from your partner everywhere — the split still uses the real
        figure.
      </p>
    </form>
  );
}
