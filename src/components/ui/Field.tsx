import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

const controlClass =
  "h-10 w-full rounded-[var(--radius)] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint focus-visible:border-brand focus-visible:outline-none";

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Label + control + optional hint, stacked. */
export function Field({ label, htmlFor, hint, children }: FieldShellProps) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink select-none">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-line-strong text-brand accent-brand ${className}`}
        {...props}
      />
      {label}
    </label>
  );
}
