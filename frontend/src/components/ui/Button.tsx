import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  primary: "border-[#43c6ff] bg-[#43c6ff]/20 text-[#dbf4ff] hover:bg-[#43c6ff]/30",
  secondary: "border-[#2f5069] bg-[#122030] text-[#d4e9f8] hover:bg-[#1a2f43]",
  ghost: "border-[#274157] bg-transparent text-[#b9d3e6] hover:bg-[#132131]",
  destructive: "border-[#9a4f55] bg-[#57252a] text-[#ffdce0] hover:bg-[#683036]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  to?: string;
}

export function Button({ variant = "secondary", children, className = "", to, ...props }: Props) {
  const baseClass =
    "inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.06em] uppercase transition";

  if (to) {
    return (
      <Link to={to} className={`${baseClass} ${variants[variant]} ${className}`}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
