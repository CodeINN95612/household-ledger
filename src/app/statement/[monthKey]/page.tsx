import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getStatementData } from "@/lib/data";
import { isValidMonthKey, currentMonthKey, formatMonthKey, shiftMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { StatementCard } from "@/components/StatementCard";
import Link from "next/link";

export default async function StatementPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  if (!isValidMonthKey(monthKey)) redirect(`/statement/${currentMonthKey()}`);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getStatementData(user, monthKey);
  const monthLabel = formatMonthKey(monthKey);

  return (
    <>
      <AppHeader user={user} active="statement" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Month navigation — mirrors the v1 dashboard */}
        <div className="mb-6 flex items-center justify-center">
          <nav className="flex items-center gap-2 text-sm" aria-label="Month navigation">
            <Link
              href={`/statement/${shiftMonthKey(monthKey, -1)}`}
              className="rounded-[var(--radius)] px-3 py-1.5 text-muted hover:text-ink transition-colors"
            >
              ← {formatMonthKey(shiftMonthKey(monthKey, -1))}
            </Link>
            <span className="px-3 py-1.5 font-medium text-ink">{monthLabel}</span>
            <Link
              href={`/statement/${shiftMonthKey(monthKey, 1)}`}
              className="rounded-[var(--radius)] px-3 py-1.5 text-muted hover:text-ink transition-colors"
            >
              {formatMonthKey(shiftMonthKey(monthKey, 1))} →
            </Link>
          </nav>
        </div>

        <StatementCard
          statement={data.statement}
          displayName={data.displayName}
          personColor={data.personColor}
          monthLabel={monthLabel}
          floatData={data.floatData}
        />

        {/* Quick link back to the shared settlement view */}
        <div className="mt-6 text-center">
          <Link
            href={`/month/${monthKey}`}
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            ← Settlement view for {monthLabel}
          </Link>
        </div>
      </main>
    </>
  );
}
