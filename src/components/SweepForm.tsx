"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { recordContributionAction } from "@/app/statement-actions";
import { centsToInputValue, parseDollarsToCents } from "@/lib/money";
import type { SweepFundRow } from "@/lib/data";

interface SweepFormProps {
  rows: SweepFundRow[];
  monthKey: string;
}

interface RowState {
  value: string; // dollar-string input
  saved: boolean;
  error: string | null;
}

/**
 * One-screen quick-entry for monthly contributions.
 * Pre-fills each fund's planned amount; user can confirm or adjust.
 */
export function SweepForm({ rows, monthKey }: SweepFormProps) {
  const [states, setStates] = useState<Record<string, RowState>>(
    Object.fromEntries(
      rows.map((r) => [
        r.fundId,
        {
          value: centsToInputValue(
            r.alreadyContributedCents > 0
              ? r.alreadyContributedCents
              : r.plannedContributionCents,
          ),
          saved: r.alreadyContributedCents > 0,
          error: null,
        },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

  function update(fundId: string, value: string) {
    setStates((prev) => ({
      ...prev,
      [fundId]: { ...prev[fundId], value, saved: false, error: null },
    }));
  }

  async function handleRecordAll() {
    setSaving(true);
    const results = await Promise.all(
      rows.map(async (r) => {
        const cents = parseDollarsToCents(states[r.fundId]?.value ?? "0");
        if (cents === null || cents < 0) {
          return { fundId: r.fundId, error: "Invalid amount." };
        }
        if (cents === 0) return { fundId: r.fundId, error: null }; // skip zero
        const res = await recordContributionAction(r.fundId, monthKey, cents);
        return { fundId: r.fundId, error: res.error ?? null };
      }),
    );

    const newStates = { ...states };
    let anyError = false;
    for (const r of results) {
      if (r.error) {
        newStates[r.fundId] = { ...newStates[r.fundId], error: r.error };
        anyError = true;
      } else {
        newStates[r.fundId] = { ...newStates[r.fundId], saved: true, error: null };
      }
    }
    setStates(newStates);
    setSaving(false);
    if (!anyError) setAllSaved(true);
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-faint">
        No allocation rules set up yet.{" "}
        <a href="/funds" className="text-brand hover:underline">
          Add funds and set your allocations first.
        </a>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {allSaved && (
        <div className="rounded-[var(--radius)] border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
          All contributions recorded for {monthKey}.
        </div>
      )}

      <div className="divide-y divide-line">
        {rows.map((r) => {
          const s = states[r.fundId];
          const inputCents = parseDollarsToCents(s?.value ?? "");
          const delta =
            inputCents !== null ? inputCents - r.plannedContributionCents : null;

          return (
            <div key={r.fundId} className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{r.fundName}</p>
                <p className="text-xs text-muted">
                  Plan: <Money cents={r.plannedContributionCents} className="text-ink" />
                  {r.alreadyContributedCents > 0 && (
                    <span className="ml-2 text-owed">
                      Already recorded: <Money cents={r.alreadyContributedCents} />
                    </span>
                  )}
                </p>
                {s?.error && <p className="text-xs text-owes mt-0.5">{s.error}</p>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Delta indicator */}
                {delta !== null && delta !== 0 && (
                  <span
                    className={`tabular text-xs ${delta > 0 ? "text-owed" : "text-owes"}`}
                  >
                    {delta > 0 ? "+" : ""}
                    <Money cents={delta} />
                  </span>
                )}

                <div className="relative w-28">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="h-9 w-full rounded-[var(--radius)] border border-line-strong bg-surface pl-7 pr-3 text-right text-sm text-ink placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
                    value={s?.value ?? ""}
                    onChange={(e) => update(r.fundId, e.target.value)}
                  />
                </div>

                {s?.saved && (
                  <span className="text-owed text-xs" title="Saved">
                    ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={handleRecordAll}
        disabled={saving || allSaved}
        className="self-end"
      >
        {saving ? "Recording…" : allSaved ? "All recorded" : "Record contributions"}
      </Button>
    </div>
  );
}
