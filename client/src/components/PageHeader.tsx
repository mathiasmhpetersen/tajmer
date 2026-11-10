export function PageHeader({
  dateline,
  title,
  meta,
  actions,
}: {
  dateline: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13px] text-muted">{dateline}</div>
        <h1 className="mt-1.5 text-[clamp(1.9rem,3vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest">
          {title}
        </h1>
        {meta && <p className="mt-2 text-sm text-muted">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
