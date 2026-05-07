import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[#365068] bg-[#142231] text-[#b2ccdf]",
  success: "border-[#2d8a69] bg-[#1f473a] text-[#9de7c9]",
  warning: "border-[#8f7434] bg-[#453915] text-[#f7d98f]",
  danger: "border-[#954f56] bg-[#4f2428] text-[#ffcdd3]",
  accent: "border-[#3d8eb6] bg-[#17384b] text-[#bce9ff]",
};

interface Props {
  children: ReactNode;
  tone?: Tone;
}

export function Badge({ children, tone = "neutral" }: Props) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold uppercase ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
