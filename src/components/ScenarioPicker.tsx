"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteScenarioAction } from "@/app/plan-actions";
import type { ProjectionScenarioData, ProjectionUserData, FundView } from "@/lib/data";
import { ScenarioForm } from "./ScenarioForm";

interface ScenarioPickerProps {
  baseline: ProjectionScenarioData | null;
  others: ProjectionScenarioData[];
  selectedId: string | null;
  users: ProjectionUserData[];
  funds: FundView[];
  forecastSharedSpendCents: number;
  currentHorizon: number;
}

export function ScenarioPicker({
  baseline,
  others,
  selectedId,
  users,
  funds,
  forecastSharedSpendCents,
  currentHorizon,
}: ScenarioPickerProps) {
  const [showForm, setShowForm] = useState(false);
  const [, startDeleteTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {/* Baseline scenario */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/plan?horizon=${currentHorizon}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
            selectedId === null
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          <span className="text-[10px] font-semibold tracking-wide uppercase">baseline</span>
          {baseline?.name ?? "Default plan"}
        </Link>

        {/* Other scenarios */}
        {others.map((s) => (
          <div key={s.id} className="flex items-center gap-1">
            <Link
              href={`/plan?horizon=${currentHorizon}&scenario=${s.id}`}
              className={`inline-flex items-center rounded-l-full border px-3 py-1 text-sm transition-colors ${
                selectedId === s.id
                  ? "border-brand/60 bg-brand-soft text-ink border-r-0"
                  : "border-line bg-surface text-muted hover:text-ink border-r-0"
              }`}
            >
              {s.name}
            </Link>
            <form
              action={deleteScenarioAction.bind(null, s.id)}
              onSubmit={() => startDeleteTransition(() => {})}
            >
              <button
                type="submit"
                className={`rounded-r-full border border-l-0 px-2 py-1 text-xs text-faint hover:text-owes hover:border-owes/30 transition-colors h-full ${
                  selectedId === s.id ? "border-brand/60 bg-brand-soft" : "border-line bg-surface"
                }`}
                title={`Delete "${s.name}"`}
              >
                ×
              </button>
            </form>
          </div>
        ))}

        {/* New scenario toggle */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted hover:border-brand hover:text-brand transition-colors"
          >
            + New scenario
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-[var(--radius)] border border-line bg-paper p-4">
          <p className="text-sm font-medium text-ink mb-3">New scenario</p>
          <ScenarioForm
            users={users}
            funds={funds}
            forecastSharedSpendCents={forecastSharedSpendCents}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
