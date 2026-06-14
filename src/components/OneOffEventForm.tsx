"use client";

import { useActionState } from "react";
import { savePlanAssumptionAction, deletePlanAssumptionAction } from "@/app/plan-actions";
import { formatCents } from "@/lib/money";
import type { OneOffEventView } from "@/lib/data";

interface OneOffEventFormProps {
  events: OneOffEventView[];
  startMonthKey: string;
  horizonMonths: number;
}

const initial = { error: undefined as string | undefined, ok: undefined as string | undefined };

export function OneOffEventForm({ events, startMonthKey, horizonMonths }: OneOffEventFormProps) {
  const [state, action, pending] = useActionState(savePlanAssumptionAction, initial);

  // Build available month options within the projection horizon
  const monthOptions: string[] = [];
  for (let i = 0; i < horizonMonths; i++) {
    const [y, m] = startMonthKey.split("-").map(Number);
    const totalMonths = y * 12 + m - 1 + i;
    const yr = Math.floor(totalMonths / 12);
    const mo = (totalMonths % 12) + 1;
    monthOptions.push(`${yr}-${String(mo).padStart(2, "0")}`);
  }

  function formatMonth(mk: string) {
    const [y, m] = mk.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Existing events */}
      {events.length > 0 && (
        <div className="flex flex-col gap-1">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 py-1.5 border-b border-line/40 last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-ink truncate">{ev.description || "—"}</span>
                <span className="ml-2 text-xs text-faint">
                  {formatMonth(ev.monthKey)} · {formatCents(ev.amountCents)} ·{" "}
                  {ev.kind === "one-off-shared" ? "shared" : "personal"}
                </span>
              </div>
              <form action={deletePlanAssumptionAction.bind(null, ev.id)}>
                <button
                  type="submit"
                  className="text-xs text-faint hover:text-owes transition-colors px-2 py-0.5 rounded hover:bg-owes-soft"
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="kind" value="one-off-shared" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Description</label>
            <input
              name="note"
              type="text"
              placeholder="e.g. Car insurance"
              className="w-full rounded border border-line bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Month</label>
            <select
              name="monthKey"
              className="w-full rounded border border-line bg-paper px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
            >
              {monthOptions.map((mk) => (
                <option key={mk} value={mk}>{formatMonth(mk)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted">$</span>
              <input
                name="amountCents"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded border border-line bg-paper pl-6 pr-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </div>
        {state.error && <p className="text-xs text-owes">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
        >
          {pending ? "Adding…" : "+ Add one-off event"}
        </button>
      </form>
    </div>
  );
}
