"use client";

import { useActionState } from "react";
import { recordAdjustmentAction } from "@/app/fund-actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

const initial = { error: undefined, ok: undefined };

interface AdjustmentFormProps {
  fundId: string;
  monthKey: string;
}

/** Client form for recording a manual adjustment or withdrawal against a fund. */
export function AdjustmentForm({ fundId, monthKey }: AdjustmentFormProps) {
  const [state, action, pending] = useActionState(recordAdjustmentAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="fundId" value={fundId} />
      <input type="hidden" name="monthKey" value={monthKey} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kind" htmlFor="adj-kind">
          <Select id="adj-kind" name="kind" defaultValue="withdrawal">
            <option value="withdrawal">Withdrawal</option>
            <option value="adjustment">Adjustment</option>
          </Select>
        </Field>
        <Field label="Amount" htmlFor="adj-amount">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
              $
            </span>
            <Input
              id="adj-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              required
            />
          </div>
        </Field>
        <Field label="Note (optional)" htmlFor="adj-note">
          <Input id="adj-note" name="note" placeholder="e.g. Goal reached" />
        </Field>
      </div>

      {state.error && <p className="text-sm text-owes">{state.error}</p>}
      {state.ok && <p className="text-sm text-owed">Entry recorded.</p>}

      <Button type="submit" variant="subtle" size="sm" disabled={pending} className="self-start">
        {pending ? "Recording…" : "Record entry"}
      </Button>
    </form>
  );
}
