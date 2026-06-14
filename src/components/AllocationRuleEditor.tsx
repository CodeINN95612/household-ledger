"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Field";
import { saveAllocationRuleAction } from "@/app/fund-actions";
import { formatCents } from "@/lib/money";

interface AllocationRuleEditorProps {
  fundId: string;
  /** Current rule, if any. */
  currentRule: { percentBps: number; fixedCentsOverride: number | null } | null;
  /** The requesting user's most recent monthly income (cents), for the live preview. */
  recentIncomeCents: number;
}

/**
 * Inline form to set the allocation rule (% of income) for a fund.
 * Shows a live "$X/month" preview based on recent income.
 */
export function AllocationRuleEditor({
  fundId,
  currentRule,
  recentIncomeCents,
}: AllocationRuleEditorProps) {
  const initialPct =
    currentRule && currentRule.fixedCentsOverride === null
      ? (currentRule.percentBps / 100).toFixed(1)
      : "";

  const [pct, setPct] = useState(initialPct);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const pctNum = parseFloat(pct);
  const bps = Math.round(pctNum * 100);
  const previewCents =
    !isNaN(pctNum) && pctNum > 0
      ? Math.floor((bps / 10000) * recentIncomeCents)
      : null;

  async function handleSave() {
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      setResult({ error: "Enter a percentage between 0 and 100." });
      return;
    }
    setSaving(true);
    setResult(null);
    const res = await saveAllocationRuleAction(fundId, bps, null);
    setResult(res);
    setSaving(false);
  }

  return (
    <div id="allocation" className="flex flex-col gap-3">
      <Field
        label="Your allocation"
        htmlFor="alloc-pct"
        hint={
          previewCents !== null
            ? `≈ ${formatCents(previewCents)} / month at your recent income`
            : "Enter a percentage, e.g. 10 for 10%"
        }
      >
        <div className="relative">
          <Input
            id="alloc-pct"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="10"
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              setResult(null);
            }}
            className="pr-8"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            %
          </span>
        </div>
      </Field>

      {result?.error && <p className="text-sm text-owes">{result.error}</p>}
      {result?.ok && <p className="text-sm text-owed">Saved.</p>}

      <Button
        type="button"
        variant="subtle"
        size="sm"
        onClick={handleSave}
        disabled={saving || pct === ""}
        className="self-start"
      >
        {saving ? "Saving…" : "Save allocation"}
      </Button>
    </div>
  );
}
