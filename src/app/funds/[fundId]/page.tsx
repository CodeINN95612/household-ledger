import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getFundDetail } from "@/lib/data";
import { buildColorMap } from "@/lib/person";
import { currentMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { FundCard } from "@/components/FundCard";
import { FundLedger } from "@/components/FundLedger";
import { AllocationRuleEditor } from "@/components/AllocationRuleEditor";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { AdjustmentForm } from "@/components/AdjustmentForm";

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ fundId: string }>;
}) {
  const { fundId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [fund, members, income] = await Promise.all([
    getFundDetail(user, fundId),
    prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true } }),
    prisma.income.findFirst({
      where: { userId: user.id },
      orderBy: { monthKey: "desc" },
      select: { amountCents: true },
    }),
  ]);

  if (!fund) notFound();

  const colorByUser = buildColorMap(members.map((m) => m.id));
  const myColor = colorByUser.get(user.id) ?? "a";
  const monthKey = currentMonthKey();
  const recentIncomeCents = income?.amountCents ?? 0;

  const canEdit =
    fund.scope === "couple" || fund.ownerUserId === user.id;

  return (
    <>
      <AppHeader user={user} active="funds" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-5">
          <Link
            href="/funds"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            ← All funds
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          {/* Fund card (summary) */}
          <FundCard fund={fund} requestingUserColor={myColor} />

          {/* Allocation rule editor */}
          <Card eyebrow="Your allocation" title={`How much you contribute to ${fund.name}`}>
            <AllocationRuleEditor
              fundId={fund.id}
              currentRule={fund.allocationRule}
              recentIncomeCents={recentIncomeCents}
            />
          </Card>

          {/* Record adjustment / withdrawal */}
          {canEdit && (
            <Card eyebrow="Record entry" title="Manual adjustment or withdrawal">
              <AdjustmentForm fundId={fund.id} monthKey={monthKey} />
            </Card>
          )}

          {/* Ledger history */}
          <Card eyebrow="History" title="All entries">
            <div className="-mx-5 -my-4 px-5 py-4">
              <FundLedger entries={fund.entries} />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
