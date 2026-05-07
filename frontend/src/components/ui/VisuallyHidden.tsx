import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function VisuallyHidden({ children, ...props }: Props) {
  return (
    <span className="sr-only" {...props}>
      {children}
    </span>
  );
}
