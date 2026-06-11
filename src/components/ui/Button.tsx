import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "subtle" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  subtle: "bg-brand-soft text-brand hover:bg-brand/15",
  ghost: "text-muted hover:bg-line/60 hover:text-ink",
  danger: "text-owes hover:bg-owes-soft",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-[0.8125rem]",
};

/** Reusable button. Defaults to a primary action at medium size. */
export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
