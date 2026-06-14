"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createFundAction } from "@/app/fund-actions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";

// Note: This is a client component because it needs live scope-dependent UI.
// Auth is enforced server-side in createFundAction.

const initialState = { error: undefined, ok: undefined };

export default function NewFundPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createFundAction, initialState);
  const [scope, setScope] = useState<"couple" | "personal">("couple");

  useEffect(() => {
    if (state.ok) router.push("/funds");
  }, [state.ok, router]);

  return (
    <>
      {/* AppHeader renders on client — use a simple header replacement here */}
      <div className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-5">
          <a href="/funds" className="text-sm text-muted hover:text-ink transition-colors">
            ← Funds
          </a>
          <span className="ml-4 text-base font-semibold text-ink">New fund</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <form action={action} className="flex flex-col gap-5">
          <Field label="Fund name" htmlFor="name">
            <Input
              id="name"
              name="name"
              placeholder='e.g. "House" or "Japan 2027"'
              required
              autoFocus
            />
          </Field>

          <Field label="Scope" htmlFor="scope">
            <Select
              id="scope"
              name="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "couple" | "personal")}
            >
              <option value="couple">Couple — shared goal, visible to both</option>
              <option value="personal">Personal — your fund only</option>
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Target amount (optional)"
              htmlFor="targetAmount"
              hint="Leave blank for open-ended saving"
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                  $
                </span>
                <Input
                  id="targetAmount"
                  name="targetAmount"
                  type="text"
                  inputMode="decimal"
                  placeholder="50,000"
                  className="pl-7"
                />
              </div>
            </Field>

            <Field
              label="Target date (optional)"
              htmlFor="targetDate"
              hint="When you'd like to reach the goal"
            >
              <Input id="targetDate" name="targetDate" type="month" />
            </Field>
          </div>

          {scope === "personal" && (
            <div className="rounded-[var(--radius)] border border-line bg-paper px-4 py-3">
              <Checkbox name="isPrivate" label="Keep this fund private" />
              <p className="mt-1 text-xs text-faint pl-6">
                Your partner sees you have personal savings, but not the balance or target.
              </p>
            </div>
          )}

          <div className="rounded-[var(--radius)] border border-line bg-paper px-4 py-3 flex flex-col gap-3">
            <Checkbox name="isSinking" label="This is a sinking fund (for a recurring bill)" />
            <Field
              label="What bill does it cover?"
              htmlFor="sinkingNote"
              hint="Optional — e.g. 'Car insurance, due in March'"
            >
              <Input
                id="sinkingNote"
                name="sinkingNote"
                placeholder="e.g. Car registration"
              />
            </Field>
          </div>

          {state.error && (
            <p className="text-sm text-owes">{state.error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create fund"}
            </Button>
            <a
              href="/funds"
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              Cancel
            </a>
          </div>
        </form>
      </main>
    </>
  );
}
