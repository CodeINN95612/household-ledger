"use client";

import { useActionState } from "react";
import { updateHouseholdSettingsAction } from "@/app/settings-actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { formatCents } from "@/lib/money";

interface HouseholdSettingsFormProps {
  users: Array<{ id: string; displayName: string }>;
  currentSettings: {
    frontingUserId: string | null;
    projectionHorizonMonths: number;
    coupleGoalSplitMode: string;
    floatReserveCentsOverride: number | null;
  };
}

const initial = { error: undefined as string | undefined, ok: undefined as boolean | undefined };

export function HouseholdSettingsForm({ users, currentSettings }: HouseholdSettingsFormProps) {
  const [state, action, pending] = useActionState(updateHouseholdSettingsAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fronting partner" htmlFor="fronting-user"
          hint="The person who pays shared expenses upfront and tracks the float">
          <Select id="fronting-user" name="frontingUserId" defaultValue={currentSettings.frontingUserId ?? ""}>
            <option value="">— None —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </Select>
        </Field>

        <Field label="Couple goal split" htmlFor="split-mode"
          hint="How couple fund contributions are divided">
          <Select id="split-mode" name="coupleGoalSplitMode" defaultValue={currentSettings.coupleGoalSplitMode}>
            <option value="proportional">Proportional to income</option>
            <option value="equal">Equal split</option>
          </Select>
        </Field>

        <Field label="Projection horizon" htmlFor="horizon"
          hint="How many months to show in the Plan view">
          <Select id="horizon" name="projectionHorizonMonths" defaultValue={String(currentSettings.projectionHorizonMonths)}>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="18">18 months</option>
            <option value="24">24 months</option>
          </Select>
        </Field>

        <Field label="Float reserve override (optional)" htmlFor="float-override"
          hint={currentSettings.floatReserveCentsOverride !== null
            ? `Currently pinned to ${formatCents(currentSettings.floatReserveCentsOverride)}`
            : "Leave blank to use auto-computed reserve"}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">$</span>
            <Input
              id="float-override"
              name="floatReserveCentsOverride"
              type="text"
              inputMode="decimal"
              defaultValue={currentSettings.floatReserveCentsOverride !== null
                ? (currentSettings.floatReserveCentsOverride / 100).toFixed(2)
                : ""}
              placeholder="auto"
              className="pl-7"
            />
          </div>
        </Field>
      </div>

      {state.error && <p className="text-sm text-owes">{state.error}</p>}
      {state.ok && <p className="text-sm text-owed">Settings saved.</p>}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
