type Status = "hit" | "partial" | "missed";

const CONFIG: Record<Status, { dot: string; label: string }> = {
  hit: { dot: "bg-owed", label: "On track" },
  partial: { dot: "bg-[#c59b3a]", label: "Partial" },
  missed: { dot: "bg-owes", label: "Missed" },
};

interface AdherenceBadgeProps {
  status: Status;
  showLabel?: boolean;
}

export function AdherenceBadge({ status, showLabel = false }: AdherenceBadgeProps) {
  const { dot, label } = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot} flex-shrink-0`} />
      {showLabel && <span className="text-xs text-muted">{label}</span>}
    </span>
  );
}
