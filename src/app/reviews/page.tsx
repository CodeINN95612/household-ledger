import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { listReviewPeriods } from "@/lib/data";
import { AppHeader } from "@/components/AppHeader";
import { currentMonthKey } from "@/lib/month";

function periodLabel(period: string): string {
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(period);
  if (qMatch) return `Q${qMatch[2]} ${qMatch[1]}`;
  return period;
}

function isAnnual(period: string): boolean {
  return /^\d{4}$/.test(period);
}

export default async function ReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const periods = await listReviewPeriods();
  const monthKey = currentMonthKey();

  return (
    <>
      <AppHeader user={user} active="reviews" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6">
          <p className="eyebrow">Plan vs actual</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Reviews</h1>
          <p className="mt-1 text-sm text-muted">Quarterly and annual summaries</p>
        </div>

        {periods.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-line px-5 py-10 text-center">
            <p className="text-sm text-muted">No completed periods to review yet.</p>
            <p className="mt-1 text-xs text-faint">
              Reviews appear once a full quarter has passed with income data entered.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {periods.map((period) => (
              <a
                key={period}
                href={`/reviews/${period}`}
                className="flex items-center justify-between rounded-[var(--radius)] border border-line bg-surface px-5 py-4 hover:border-brand/30 hover:bg-brand-soft/20 transition-colors group"
              >
                <div>
                  <p className="font-medium text-ink">{periodLabel(period)}</p>
                  <p className="text-xs text-faint mt-0.5">
                    {isAnnual(period) ? "Annual summary" : "Quarterly review"}
                  </p>
                </div>
                <span className="text-muted group-hover:text-brand transition-colors">→</span>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
