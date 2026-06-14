"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import type { SafeUser } from "@/lib/auth";
import { currentMonthKey } from "@/lib/month";

interface AppHeaderProps {
  user: SafeUser;
  active: "month" | "history" | "statement" | "funds" | "plan" | "health" | "reviews" | "settings";
  currentMonthKey?: string;
}

function readyQuarterPeriod(): string | null {
  const [y, m] = currentMonthKey().split("-").map(Number);
  if (![1, 4, 7, 10].includes(m)) return null;
  const prevQ = m === 1 ? 4 : (m - 1) / 3;
  const prevY = m === 1 ? y - 1 : y;
  return `${prevY}-Q${prevQ}`;
}

export function AppHeader({ user, active, currentMonthKey: mk }: AppHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const stmtMonthKey = mk ?? currentMonthKey();
  const reviewPeriod = readyQuarterPeriod();

  const navItems = [
    { key: "statement" as const, label: "My month",   href: `/statement/${stmtMonthKey}` },
    { key: "month"    as const, label: "Settlement",  href: "/" },
    { key: "funds"    as const, label: "Funds",       href: "/funds" },
    { key: "plan"     as const, label: "Plan",        href: "/plan" },
    { key: "health"   as const, label: "Health",      href: "/health" },
    { key: "reviews"  as const, label: "Reviews",     href: "/reviews" },
    { key: "history"  as const, label: "History",     href: "/history" },
    { key: "settings" as const, label: "Settings",    href: "/settings" },
  ];

  const nav = (onNav?: () => void) => (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          onClick={onNav}
          className={[
            "flex items-center rounded-r-[var(--radius)] border-l-2 py-2 pl-3 pr-3 text-sm transition-colors",
            active === item.key
              ? "border-brand font-medium text-brand"
              : "border-transparent text-muted hover:border-line-strong hover:text-ink",
          ].join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const bottom = (onNav?: () => void) => (
    <div className="mt-auto shrink-0">
      {reviewPeriod && (
        <div className="mx-3 mb-3 rounded-[var(--radius)] bg-brand-soft px-3 py-2.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-brand/70">
            Q{reviewPeriod.split("-Q")[1]} {reviewPeriod.split("-Q")[0]}
          </p>
          <Link
            href={`/reviews/${reviewPeriod}`}
            onClick={onNav}
            className="text-xs font-medium text-brand hover:underline"
          >
            Review ready →
          </Link>
        </div>
      )}
      <div className="border-t border-line px-4 py-4">
        <p className="mb-2 truncate text-xs text-faint">{user.displayName}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  const wordmark = (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
        ₿
      </span>
      <span className="text-[0.875rem] font-semibold tracking-tight text-ink">
        Household Ledger
      </span>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────── */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[220px] flex-col border-r border-line bg-surface lg:flex">
        {wordmark}
        <div className="flex-1 overflow-y-auto">
          {nav()}
        </div>
        {bottom()}
      </aside>

      {/* ── Mobile top bar ───────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand text-xs font-bold text-white">
            ₿
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Household Ledger</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:text-ink"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path
              d="M1 1h16M1 7h16M1 13h16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* ── Mobile drawer ────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-[240px] flex-col border-r border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
                  ₿
                </span>
                <span className="text-[0.875rem] font-semibold tracking-tight text-ink">
                  Household Ledger
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-7 w-7 items-center justify-center rounded text-muted transition-colors hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {nav(() => setMobileOpen(false))}
            </div>
            {bottom(() => setMobileOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
