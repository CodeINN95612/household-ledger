import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getFunds } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { HouseholdSettingsForm } from "@/components/HouseholdSettingsForm";
import { AllocationRulesEditor } from "@/components/AllocationRulesEditor";
import { FundManagerSection } from "@/components/FundManagerSection";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allUsers, funds, allocationRules, settings, recentIncomes] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    getFunds(user),
    prisma.allocationRule.findMany({
      where: { userId: user.id, active: true },
      include: { fund: { select: { name: true } } },
    }),
    prisma.householdSettings.findUnique({ where: { id: "singleton" } }),
    prisma.income.findMany({
      where: { userId: user.id },
      orderBy: { monthKey: "desc" },
      take: 3,
      select: { amountCents: true },
    }),
  ]);

  const rules = allocationRules.map((r) => ({
    fundId: r.fundId,
    fundName: r.fund.name,
    percentBps: r.percentBps,
    fixedCentsOverride: r.fixedCentsOverride,
  }));

  const incomeAmounts = recentIncomes.map((i) => i.amountCents);
  const recentIncomeCents =
    incomeAmounts.length > 0
      ? Math.round(incomeAmounts.reduce((s, v) => s + v, 0) / incomeAmounts.length)
      : 0;

  const currentSettings = {
    frontingUserId: settings?.frontingUserId ?? null,
    projectionHorizonMonths: settings?.projectionHorizonMonths ?? 12,
    coupleGoalSplitMode: settings?.coupleGoalSplitMode ?? "proportional",
    floatReserveCentsOverride: settings?.floatReserveCentsOverride ?? null,
  };

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader user={user} active="settings" />
      <main className="mx-auto max-w-3xl px-5 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
          <p className="mt-1 text-sm text-muted">Household configuration and allocation rules.</p>
        </div>

        <Card>
          <div className="px-5 py-4 border-b border-line">
            <p className="font-medium text-ink text-sm">Household</p>
          </div>
          <div className="px-5 py-4">
            <HouseholdSettingsForm users={allUsers} currentSettings={currentSettings} />
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-line">
            <p className="font-medium text-ink text-sm">Your allocation rules</p>
            <p className="text-xs text-muted mt-0.5">
              How your income is split across couple funds each month.
            </p>
          </div>
          <div className="px-5 py-4">
            <AllocationRulesEditor
              rules={rules}
              funds={funds}
              recentIncomeCents={recentIncomeCents}
            />
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-line">
            <p className="font-medium text-ink text-sm">Funds</p>
            <p className="text-xs text-muted mt-0.5">
              Create, edit, and archive savings goals.
            </p>
          </div>
          <div className="px-5 py-4">
            <FundManagerSection funds={funds} requestingUserId={user.id} />
          </div>
        </Card>
      </main>
    </div>
  );
}
