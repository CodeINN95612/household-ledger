import { personClasses, type PersonColor } from "@/lib/person";

interface PersonTokenProps {
  name: string;
  color: PersonColor;
  isSelf?: boolean;
  className?: string;
}

/** A person's identity chip: colored initial + name, with a "(you)" marker. */
export function PersonToken({ name, color, isSelf = false, className = "" }: PersonTokenProps) {
  const c = personClasses[color];
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${c.dot}`}
        aria-hidden
      >
        {initial}
      </span>
      <span className="font-medium text-ink">
        {name}
        {isSelf ? <span className="ml-1 font-normal text-faint">(you)</span> : null}
      </span>
    </span>
  );
}
