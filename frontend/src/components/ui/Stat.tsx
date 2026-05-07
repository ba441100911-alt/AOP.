interface Props {
  label: string;
  value: string | number;
  foot?: string;
}

export function Stat({ label, value, foot }: Props) {
  return (
    <article className="app-panel p-3">
      <p className="m-0 text-[0.66rem] uppercase tracking-[0.09em] text-[#8fb0c5]">{label}</p>
      <p className="m-0 mt-1 text-[1.2rem] font-bold text-[#e6f5ff]">{value}</p>
      {foot ? <p className="m-0 mt-1 text-[0.72rem] text-[#9eb8cc]">{foot}</p> : null}
    </article>
  );
}
