import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-sage-500 text-white hover:bg-sage-600 disabled:opacity-40",
  soft: "bg-sage-50 text-sage-700 hover:bg-sage-100 disabled:opacity-40",
  ghost: "text-ink-soft hover:bg-sand-100 disabled:opacity-40",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-40",
};
const SIZE: Record<Size, string> = { sm: "px-3 py-1 text-sm", md: "px-4 py-2 text-sm" };

export function Button({
  variant = "primary", size = "md", className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}
