interface Props {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: Props) {
  return (
    <header className="mb-3">
      <h3 className="m-0 text-[0.8rem] uppercase tracking-[0.1em] text-[#b2d3e9]">{title}</h3>
      {subtitle ? <p className="m-0 mt-1 text-[0.74rem] text-[#9eb8cc]">{subtitle}</p> : null}
    </header>
  );
}
