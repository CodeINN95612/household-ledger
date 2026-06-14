const OPTIONS = [6, 12, 18, 24] as const;

interface HorizonSelectorProps {
  current: number;
}

/** Tab bar for choosing the projection horizon. Navigates via URL query param. */
export function HorizonSelector({ current }: HorizonSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-[var(--radius)] border border-line bg-paper p-1">
      {OPTIONS.map((n) => (
        <a
          key={n}
          href={`?horizon=${n}`}
          className={`rounded-[calc(var(--radius)-2px)] px-3 py-1 text-sm transition-colors ${
            current === n
              ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,.06)]"
              : "text-muted hover:text-ink"
          }`}
        >
          {n}mo
        </a>
      ))}
    </div>
  );
}
