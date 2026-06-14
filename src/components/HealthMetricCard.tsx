import type { ReactNode } from "react";

type Band = "low" | "ok" | "strong" | "unknown";

interface HealthMetricCardProps {
  eyebrow: string;
  value: ReactNode;
  context?: ReactNode;
  band?: Band;
  children?: ReactNode;
}

const bandStyles: Record<Band, string> = {
  strong: "border-l-[3px] border-owed",
  ok: "border-l-[3px] border-[#c59b3a]",
  low: "border-l-[3px] border-owes",
  unknown: "",
};

const bandBg: Record<Band, string> = {
  strong: "bg-brand-soft/50",
  ok: "bg-[#fdf6e3]/60",
  low: "bg-owes-soft/40",
  unknown: "bg-surface",
};

export function HealthMetricCard({
  eyebrow,
  value,
  context,
  band = "unknown",
  children,
}: HealthMetricCardProps) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-line ${bandStyles[band]} ${bandBg[band]} px-5 py-4 flex flex-col gap-2`}
    >
      <p className="eyebrow">{eyebrow}</p>
      <div className="text-2xl font-semibold text-ink tabular">{value}</div>
      {context && <p className="text-xs text-muted">{context}</p>}
      {children}
    </div>
  );
}
