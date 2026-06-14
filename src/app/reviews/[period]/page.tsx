import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getReviewSummary } from "@/lib/data";
import { currentMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { QuarterlyReview } from "@/components/QuarterlyReview";
import { AnnualReset } from "@/components/AnnualReset";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const summary = await getReviewSummary(user, period);
  if (!summary) notFound();

  const monthKey = currentMonthKey();

  return (
    <>
      <AppHeader user={user} active="reviews" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-5">
          <a href="/reviews" className="text-sm text-muted hover:text-ink transition-colors">
            ← All reviews
          </a>
        </div>

        <div className="mb-6">
          <p className="eyebrow">{summary.isAnnual ? "Annual review" : "Quarterly review"}</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">{summary.periodLabel}</h1>
        </div>

        <Card>
          {summary.isAnnual ? (
            <AnnualReset summary={summary} />
          ) : (
            <QuarterlyReview summary={summary} />
          )}
        </Card>
      </main>
    </>
  );
}
