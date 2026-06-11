import { type ReactNode } from "react";

interface CardProps {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title?: ReactNode;
  /** Right-aligned content in the header row (e.g. an action). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A white surface section with an optional eyebrow/title header. */
export function Card({ eyebrow, title, action, children, className = "" }: CardProps) {
  const hasHeader = eyebrow || title || action;
  return (
    <section
      className={`rounded-[calc(var(--radius)+2px)] border border-line bg-surface ${className}`}
    >
      {hasHeader ? (
        <header className="flex items-end justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-1">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
