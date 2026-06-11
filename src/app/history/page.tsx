import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { listMonths } from "@/lib/data";
import { redirect } from "next/navigation";
import { formatMonthKey, currentMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const months = await listMonths(user);
  const current = currentMonthKey();

  return (
    <>
      <AppHeader user={user} active="history" />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6">
          <span className="eyebrow">History</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Past months</h1>
        </div>

        <Card>
          <div className="-mx-5 -my-4">
            <ul>
              {months.map((m) => (
                <li key={m.monthKey}>
                  <Link
                    href={`/month/${m.monthKey}`}
                    className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 transition-colors last:border-0 hover:bg-paper"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{formatMonthKey(m.monthKey)}</span>
                      {m.monthKey === current ? (
                        <span className="text-xs text-faint">current</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-muted">
                        {m.expenseCount} {m.expenseCount === 1 ? "expense" : "expenses"}
                      </span>
                      <span className="w-28 text-right">
                        <span className="text-faint">shared </span>
                        <Money cents={m.totalSharedCents} className="text-ink" />
                      </span>
                      <span className="text-faint" aria-hidden>
                        ›
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </main>
    </>
  );
}
