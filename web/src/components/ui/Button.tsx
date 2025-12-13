import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition will-change-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-[color:var(--wyws-neon)] text-[color:var(--wyws-ink)] hover:brightness-110",
  secondary:
    "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/14",
  ghost: "bg-transparent text-white/80 hover:bg-white/10 hover:text-white",
  danger:
    "bg-[color:var(--wyws-red)] text-white hover:brightness-110 ring-1 ring-white/10",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}


