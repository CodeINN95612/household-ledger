import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getSweepData } from "@/lib/data";
import { isValidMonthKey, currentMonthKey, formatMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { SweepForm } from "@/components/SweepForm";
import { Card } from "@/components/ui/Card";

export default async function SweepPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  if (!isValidMonthKey(monthKey)) redirect(`/funds/sweep/${currentMonthKey()}`);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await getSweepData(user, monthKey);
  const monthLabel = formatMonthKey(monthKey);

  return (
    <>
      <AppHeader user={user} active="funds" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6">
          <a href="/funds" className="text-sm text-muted hover:text-ink transition-colors">
            ← All funds
          </a>
          <h1 className="mt-3 text-xl font-semibold text-ink">Monthly sweep</h1>
          <p className="mt-1 text-sm text-muted">
            Record your contributions for {monthLabel}. Amounts are pre-filled from your
            allocation rules — adjust if needed.
          </p>
        </div>

        <Card>
          <SweepForm rows={rows} monthKey={monthKey} />
        </Card>
      </main>
    </>
  );
}
