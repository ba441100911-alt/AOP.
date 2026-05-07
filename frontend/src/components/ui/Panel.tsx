import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Panel({ children, className = "", ...props }: Props) {
  return (
    <section className={`app-panel p-3 ${className}`} {...props}>
      {children}
    </section>
  );
}
