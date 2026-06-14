import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getFunds } from "@/lib/data";
import { buildColorMap } from "@/lib/person";
import { currentMonthKey } from "@/lib/month";
import { AppHeader } from "@/components/AppHeader";
import { FundCard } from "@/components/FundCard";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";

export default async function FundsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [funds, members] = await Promise.all([
    getFunds(user),
    prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true } }),
  ]);

  const colorByUser = buildColorMap(members.map((m) => m.id));
  const myColor = colorByUser.get(user.id) ?? "a";
  const monthKey = currentMonthKey();

  const coupleFunds = funds.filter((f) => f.scope === "couple");
  const myFunds = funds.filter((f) => f.scope === "personal");

  return (
    <>
      <AppHeader user={user} active="funds" currentMonthKey={monthKey} />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Funds</h1>
            <p className="mt-0.5 text-sm text-muted">
              Named pots for goals, savings, and sinking funds.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/funds/sweep/${monthKey}`}>
              <Button variant="subtle" size="sm">Monthly sweep</Button>
            </Link>
            <Link href="/funds/new">
              <Button size="sm">New fund</Button>
            </Link>
          </div>
        </div>

        {funds.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-8">
            {coupleFunds.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3">Couple funds</h2>
                <div className="flex flex-col gap-3">
                  {coupleFunds.map((f) => (
                    <FundCard
                      key={f.id}
                      fund={f}
                      requestingUserColor={myColor}
                      editable
                    />
                  ))}
                </div>
              </section>
            )}

            {myFunds.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3">Your funds</h2>
                <div className="flex flex-col gap-3">
                  {myFunds.map((f) => (
                    <FundCard
                      key={f.id}
                      fund={f}
                      requestingUserColor={myColor}
                      editable
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[calc(var(--radius)+2px)] border border-line bg-surface px-6 py-12 text-center">
      <p className="text-base font-medium text-ink">No funds yet</p>
      <p className="mt-1 text-sm text-muted">
        Create your first fund to start tracking goals and saving as a team.
      </p>
      <div className="mt-5">
        <Link href="/funds/new">
          <Button>Create a fund</Button>
        </Link>
      </div>
    </div>
  );
}
