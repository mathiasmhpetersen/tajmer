import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ARTISTS_BY_SLUG } from "@shared/artists";
import { fetchArtistBudget } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { formatMoneyWhole } from "@/lib/format";
import { BC, ddmm, longDate, TEMPO_HEX } from "@/lib/budget";
import { AlarmBar, KpiTile, WarningList } from "@/components/budget/BudgetBits";
import { BudgetChart } from "@/components/budget/BudgetChart";
import { RefreshButton, SegControl, nf } from "@/components/budget/BudgetShell";
import { AdminOnly } from "./BudgetOverview";

export function BudgetArtist({ slug }: { slug: string }) {
  const isClient = useIsClient();
  const known = ARTISTS_BY_SLUG[slug];
  const [scope, setScope] = useState("aftalt");
  const [suggested, setSuggested] = useState(false);
  const forceRef = useRef(false);

  const query = useQuery({
    queryKey: ["budget-artist", slug],
    queryFn: () => {
      const nocache = forceRef.current;
      forceRef.current = false;
      return fetchArtistBudget(slug, nocache);
    },
    enabled: Boolean(known) && !isClient,
  });

  const refresh = () => {
    forceRef.current = true;
    query.refetch();
  };

  if (isClient) return <AdminOnly />;
  if (!known) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center" style={{ color: BC.text }}>
        <h1 className="text-2xl font-semibold">Ukendt kunstner</h1>
        <Link href="/budget" className="mt-5 text-sm hover:underline" style={{ color: BC.orange }}>
          Tilbage til budget
        </Link>
      </div>
    );
  }

  const b = query.data;
  const calc = b?.calc;
  const red = calc?.tempo.status === "critical";
  const suggestBelob = b?.suggestion.rows.find((r) => r.current)?.perDag ?? calc?.skalPrDag ?? null;
  const currentPeriod = b?.periods.find((p) => p.label === b.currentPeriodLabel) ?? null;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1248, color: BC.text }}>
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/budget" className="inline-flex items-center gap-1 text-[13px] hover:underline" style={{ color: BC.textGrey }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            Budget
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="flex size-11 items-center justify-center rounded-[12px] text-[15px] font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: BC.textDim }}
            >
              {initials(known.name)}
            </span>
            <div>
              <h1 className="text-[32px] font-semibold leading-none" style={{ letterSpacing: "-0.025em", color: BC.text }}>
                {known.name}
              </h1>
              {b && (b.show.show || b.show.premiere) && (
                <div className="mt-1 text-[13px]" style={{ color: BC.textGrey }}>
                  {b.show.show}
                  {b.show.show && b.show.premiere ? " · " : ""}
                  {b.show.premiere ? `premiere ${longDate(b.show.premiere)}` : ""}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SegControl value={scope} onChange={setScope} />
          <RefreshButton onClick={refresh} loading={query.isFetching} />
        </div>
      </div>

      {query.isError ? (
        <div className="mt-6 text-[14px]" style={{ color: BC.red }}>
          {(query.error as Error).message}
        </div>
      ) : query.isLoading || !b || !calc ? (
        <div className="mt-10 h-80 animate-pulse rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}` }} />
      ) : (
        <div className="mt-8 flex flex-col" style={{ gap: 40 }}>
          {red && (
            <AlarmBar
              problem={`${known.name}: ${calc.tempo.text}`}
              consequence={calc.tomDato ? `Pengene er brugt omkring ${ddmm(calc.tomDato)} hvis intet ændres.` : "Forbruget ligger over planen."}
              action={
                suggestBelob != null
                  ? { label: suggested ? "Forslag noteret ✓" : `Foreslå ${nf(suggestBelob)} kr. i Meta`, onClick: () => setSuggested(true) }
                  : undefined
              }
            />
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <KpiTile label="Aftalt" value={calc.aftalt != null ? formatMoneyWhole(calc.aftalt) : "—"} context={currentPeriod ? `${ddmm(calc.from)}–${ddmm(calc.to)}` : "Ingen aktiv periode"} accent />
            <KpiTile label="Brugt" value={formatMoneyWhole(calc.brugt)} context="Til og med i går" />
            <KpiTile label="Resterende" value={calc.rest != null ? formatMoneyWhole(calc.rest) : "—"} context={`Skal bruge ${calc.skalPrDag != null ? nf(calc.skalPrDag) : "—"} kr./dag`} />
            <KpiTile
              label="Tempo"
              value={calc.afvigelse != null ? `${calc.afvigelse >= 0 ? "+" : ""}${Math.round(calc.afvigelse)} pt` : "—"}
              color={TEMPO_HEX[calc.tempo.status]}
              context={<span style={{ color: TEMPO_HEX[calc.tempo.status] }}>{calc.tempo.text}</span>}
            />
          </div>

          {/* chart */}
          <section>
            <SectionTitle>Dagligt forbrug mod det, der er råd til</SectionTitle>
            {calc.from && calc.to ? (
              <div className="rounded-[14px] p-6" style={{ background: BC.card, border: `1px solid ${BC.border}` }}>
                <BudgetChart
                  from={calc.from}
                  to={calc.to}
                  today={new Date().toISOString().slice(0, 10)}
                  dailySpend={b.dailySpend}
                  koererNu={calc.koererNu.amount}
                  skalPrDag={calc.skalPrDag}
                  tomDato={calc.tomDato}
                  paydays={b.paydays}
                />
              </div>
            ) : (
              <EmptyPlan />
            )}
          </section>

          {/* two columns */}
          <div className="flex flex-wrap gap-6">
            <section style={{ flex: "999 1 560px", minWidth: 0 }}>
              <SectionTitle>Forslag til resten af perioden</SectionTitle>
              <div className="overflow-hidden rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}` }}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BC.border}` }}>
                      {["Periode", "Hvorfor", "Pr. dag"].map((h, i) => (
                        <th key={h} scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: BC.textGrey, textAlign: i === 2 ? "right" : "left" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.suggestion.rows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-[14px]" style={{ color: BC.textGrey }}>
                          Ingen resterende dage i perioden.
                        </td>
                      </tr>
                    ) : (
                      b.suggestion.rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${BC.borderFaint}` }}>
                          <td className="tnum px-4 py-3 text-[14px]" style={{ color: r.current ? BC.orange : BC.text, fontWeight: r.current ? 600 : 400 }}>
                            {ddmm(r.from)}–{ddmm(r.to)}
                          </td>
                          <td className="px-4 py-3 text-[14px]" style={{ color: r.current ? BC.orange : BC.textDim, fontWeight: r.current ? 600 : 400 }}>
                            {r.why}
                          </td>
                          <td className="tnum px-4 py-3 text-right text-[14px]" style={{ color: r.current ? BC.orange : BC.text, fontWeight: r.current ? 600 : 400 }}>
                            {nf(r.perDag)} kr.
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {b.suggestion.rest != null && (
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${BC.border}` }}>
                        <td className="px-4 py-3 text-[13px] uppercase tracking-[0.06em]" style={{ color: BC.textGrey }} colSpan={2}>
                          Total (= resterende)
                        </td>
                        <td className="tnum px-4 py-3 text-right text-[14px] font-semibold">{formatMoneyWhole(b.suggestion.rest)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {currentPeriod?.note && (
                <div className="mt-3 rounded-[12px] p-3.5 text-[13px]" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BC.borderFaint}`, color: BC.textGrey }}>
                  <span className="font-medium" style={{ color: BC.textDim }}>Note: </span>
                  {currentPeriod.note}
                </div>
              )}
            </section>

            <section style={{ flex: "1 1 320px", minWidth: 0 }}>
              <SectionTitle>Perioder</SectionTitle>
              <ol className="relative flex flex-col gap-4 pl-5">
                {b.periods.map((p, i) => {
                  const current = p.label === b.currentPeriodLabel;
                  return (
                    <li key={i} className="relative">
                      <span className="absolute -left-5 top-1 size-2.5 rounded-full" style={{ background: current ? BC.orange : BC.textFaint }} />
                      <div className="text-[14px] font-medium" style={{ color: current ? BC.text : BC.textGrey }}>
                        {p.label}
                      </div>
                      <div className="tnum text-[13px]" style={{ color: BC.textGrey }}>
                        {ddmm(p.from)}–{ddmm(p.to)} · {p.periodBudget != null ? `${nf(p.periodBudget)} kr.` : "—"}
                      </div>
                    </li>
                  );
                })}
                {b.periods.length === 0 && (
                  <p className="text-[13px]" style={{ color: BC.textGrey }}>
                    Ingen perioder.
                  </p>
                )}
              </ol>

              <div className="mt-8">
                <SectionTitle>Advarsler{b.warnings.length > 0 ? ` (${b.warnings.length})` : ""}</SectionTitle>
                <WarningList warnings={b.warnings} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[17px] font-semibold" style={{ color: BC.text }}>
      {children}
    </h2>
  );
}

function EmptyPlan() {
  return (
    <div className="rounded-[14px] p-10 text-center text-[14px]" style={{ background: BC.card, border: `1px dashed ${BC.border}`, color: BC.textGrey }}>
      Ingen plan indlæst endnu.
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
