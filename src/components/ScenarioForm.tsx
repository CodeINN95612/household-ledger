"use client";

import { useActionState } from "react";
import { saveScenarioAction } from "@/app/plan-actions";
import type { ProjectionUserData, FundView } from "@/lib/data";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { formatCents } from "@/lib/money";

interface ScenarioFormProps {
  users: ProjectionUserData[];
  funds: FundView[];
  forecastSharedSpendCents: number;
  onCancel: () => void;
}

const initial = { error: undefined as string | undefined, ok: undefined as string | undefined };

export function ScenarioForm({ users, funds, forecastSharedSpendCents, onCancel }: ScenarioFormProps) {
  const [state, formAction, pending] = useActionState(saveScenarioAction, initial);

  function buildOverridesJson(form: HTMLFormElement): string {
    const fd = new FormData(form);
    const overrides: Record<string, unknown> = {};

    const incomeByUserId: Record<string, number> = {};
    for (const u of users) {
      const val = fd.get(`income_${u.userId}`)?.toString().trim();
      if (val) {
        const cents = Math.round(parseFloat(val.replace(/,/g, "")) * 100);
        if (!isNaN(cents) && cents >= 0) incomeByUserId[u.userId] = cents;
      }
    }
    if (Object.keys(incomeByUserId).length > 0) overrides.incomeByUserId = incomeByUserId;

    const allocOverrides: Array<{ userId: string; fundId: string; percentBps: number; fixedCentsOverride: null }> = [];
    for (const u of users) {
      for (const f of funds) {
        const val = fd.get(`alloc_${u.userId}_${f.id}`)?.toString().trim();
        if (val) {
          const pct = parseFloat(val);
          if (!isNaN(pct) && pct >= 0) {
            allocOverrides.push({ userId: u.userId, fundId: f.id, percentBps: Math.round(pct * 100), fixedCentsOverride: null });
          }
        }
      }
    }
    if (allocOverrides.length > 0) overrides.allocationRuleOverrides = allocOverrides;

    const ssVal = fd.get("sharedSpend")?.toString().trim();
    if (ssVal) {
      const cents = Math.round(parseFloat(ssVal.replace(/,/g, "")) * 100);
      if (!isNaN(cents) && cents >= 0) overrides.sharedSpendCents = cents;
    }

    return JSON.stringify(overrides);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Update the hidden overridesJson field before React reads the FormData
    const form = e.currentTarget;
    const hidden = form.querySelector<HTMLInputElement>('input[name="overridesJson"]');
    if (hidden) hidden.value = buildOverridesJson(form);
    // Do NOT preventDefault — let React's form action proceed
  }

  if (state.ok) {
    return <p className="text-sm text-owed py-2">{state.ok}</p>;
  }

  const coupleFunds = funds.filter((f) => f.scope === "couple");

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="overridesJson" defaultValue="{}" />

      <Field label="Scenario name" htmlFor="sc-name">
        <Input id="sc-name" name="name" placeholder='e.g. "Save harder 2027"' required autoFocus />
      </Field>

      {/* Income overrides */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Income assumptions
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <Field
              key={u.userId}
              label={`${u.displayName} monthly income`}
              htmlFor={`sc-inc-${u.userId}`}
              hint={
                u.defaultIncomeCents > 0
                  ? `Current median: ${formatCents(u.defaultIncomeCents)}/mo`
                  : "No income recorded"
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                  $
                </span>
                <Input
                  id={`sc-inc-${u.userId}`}
                  name={`income_${u.userId}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={
                    u.defaultIncomeCents > 0 ? formatCents(u.defaultIncomeCents) : "0.00"
                  }
                  className="pl-7"
                />
              </div>
            </Field>
          ))}
        </div>
      </div>

      {/* Allocation overrides — couple funds only */}
      {coupleFunds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Allocation overrides (%)
          </p>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper">
                  <th className="py-2 pl-3 pr-4 text-left font-medium text-muted">Fund</th>
                  {users.map((u) => (
                    <th key={u.userId} className="py-2 px-3 text-right font-medium text-muted">
                      {u.displayName.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupleFunds.map((f) => (
                  <tr key={f.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pl-3 pr-4 text-ink truncate max-w-[8rem]">{f.name}</td>
                    {users.map((u) => {
                      const existing = u.allocationRules.find((r) => r.fundId === f.id);
                      const pct =
                        existing && existing.fixedCentsOverride === null
                          ? (existing.percentBps / 100).toFixed(1)
                          : "";
                      return (
                        <td key={u.userId} className="py-2 px-3 text-right">
                          <input
                            name={`alloc_${u.userId}_${f.id}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={pct}
                            placeholder="—"
                            className="w-16 rounded border border-line bg-paper px-2 py-1 text-right text-sm tabular focus:border-brand focus:outline-none"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shared spend override */}
      <Field
        label="Shared spend override (optional)"
        htmlFor="sc-shared"
        hint={`Current forecast: ${formatCents(forecastSharedSpendCents)}/mo`}
      >
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
            $
          </span>
          <Input
            id="sc-shared"
            name="sharedSpend"
            type="text"
            inputMode="decimal"
            placeholder="leave blank to use forecast"
            className="pl-7"
          />
        </div>
      </Field>

      {state.error && <p className="text-sm text-owes">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save scenario"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
