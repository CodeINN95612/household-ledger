import { type ReactNode } from "react";
import type { ExpenseType } from "@/lib/settlement";

const pill =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

/** "shared" / "personal" tag for an expense. */
export function TypeBadge({ type }: { type: ExpenseType }) {
  if (type === "shared") {
    return <span className={`${pill} bg-brand-soft text-brand`}>Shared</span>;
  }
  return <span className={`${pill} bg-line text-muted`}>Personal</span>;
}

/** Shown in place of another user's hidden private income amount (spec §4). */
export function PrivateTag({ children = "Private" }: { children?: ReactNode }) {
  return (
    <span className={`${pill} bg-line text-faint`} title="Hidden by this person">
      {children}
    </span>
  );
}
