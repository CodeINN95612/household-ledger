import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getMonthData, getSettlementView, getSpendingAnomalyData } from "@/lib/data";
import { isValidMonthKey, currentMonthKey } from "@/lib/month";
import { buildColorMap } from "@/lib/person";
import { createExpenseAction } from "@/app/month-actions";
import { AppHeader } from "@/components/AppHeader";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { SettlementStatement } from "@/components/SettlementStatement";
import { BalanceSheet } from "@/components/BalanceSheet";
import { IncomePanel } from "@/components/IncomePanel";
import { ExpenseList } from "@/components/ExpenseList";
import { ExpenseForm } from "@/components/ExpenseForm";
import { AnomalyFlag } from "@/components/AnomalyFlag";
import { Card } from "@/components/ui/Card";

export default async function MonthPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  if (!isValidMonthKey(monthKey)) redirect(`/month/${currentMonthKey()}`);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [monthData, settlement, anomaly] = await Promise.all([
    getMonthData(user, monthKey),
    getSettlementView(user, monthKey),
    getSpendingAnomalyData(monthKey),
  ]);

  const colorByUser = buildColorMap(monthData.members.map((m) => m.id));
  const nameByUser = new Map(monthData.members.map((m) => [m.id, m.displayName]));

  return (
    <>
      <AppHeader user={user} active="month" />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center justify-center">
          <MonthSwitcher monthKey={monthKey} />
        </div>

        <div className="flex flex-col gap-6">
          <SettlementStatement
            settlement={settlement}
            colorByUser={colorByUser}
            nameByUser={nameByUser}
          />

          {settlement.status === "ready" ? (
            <BalanceSheet
              members={settlement.members}
              colorByUser={colorByUser}
              requestingUserId={user.id}
            />
          ) : null}

          <IncomePanel
            monthKey={monthKey}
            incomes={monthData.incomes}
            colorByUser={colorByUser}
          />

          <Card eyebrow="Add expense" title="Log a cost">
            <ExpenseForm
              action={createExpenseAction}
              members={monthData.members}
              defaultPaidByUserId={user.id}
              submitLabel="Add expense"
              mode="create"
            />
          </Card>

          {anomaly && (
            <AnomalyFlag
              currentVariableCents={anomaly.currentVariableCents}
              avgPrior6VariableCents={anomaly.avgPrior6VariableCents}
            />
          )}

          <Card eyebrow="Expenses" title="This month">
            <div className="-mx-5 -my-4">
              <ExpenseList
                expenses={monthData.expenses}
                members={monthData.members}
                colorByUser={colorByUser}
                defaultPaidByUserId={user.id}
              />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
