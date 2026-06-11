import Link from "next/link";
import { logoutAction } from "@/app/auth-actions";
import type { SafeUser } from "@/lib/auth";

interface AppHeaderProps {
  user: SafeUser;
  active: "month" | "history";
}

/** Top bar: wordmark, primary nav, current user, and logout. */
export function AppHeader({ user, active }: AppHeaderProps) {
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
            ₿
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight">Household Ledger</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" current={active === "month"}>
            This month
          </NavLink>
          <NavLink href="/history" current={active === "history"}>
            History
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{user.displayName}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-[var(--radius)] px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-line/60 hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-[var(--radius)] px-3 py-1.5 transition-colors ${
        current ? "bg-line/70 font-medium text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
