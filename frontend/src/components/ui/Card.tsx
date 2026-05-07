import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = "", ...props }: Props) {
  return (
    <div className={`app-panel ${className}`} {...props}>
      {children}
    </div>
  );
}
