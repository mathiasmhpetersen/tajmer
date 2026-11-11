import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { BudgetNextAdjustment } from "@shared/budget";
import { fetchBudgetOverview } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { formatMoneyWhole } from "@/lib/format";
import { BC, ddmm, TEMPO_HEX } from "@/lib/budget";
import { AlarmBar, KpiTile, PlanBar, WarningList } from "@/components/budget/BudgetBits";
import { SegControl, BudgetHeader, nf } from "@/components/budget/BudgetShell";

export function BudgetOverview() {
  const isClient = useIsClient();
  const [scope, setScope] = useState("aftalt");
  const forceRef = useRef(false);
  const query = useQuery({
    queryKey: ["budget-overview"],
    queryFn: () => {
      const nocache = forceRef.current;
      forceRef.current = false;
      return fetchBudgetOverview(nocache);
    },
    enabled: !isClient,
  });

  const refresh = () => {
    forceRef.current = true;
    query.refetch();
  };

  if (isClient) return <AdminOnly />;
  const data = query.data;
  const worst = data?.artists.find((a) => a.tempo.status === "critical") ?? null;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1248, color: BC.text }}>
      <BudgetHeader
        title="Økonomi"
        subtitle="Planlagt budget mod faktisk forbrug pr. kunstner"
        onRefresh={refresh}
        refreshing={query.isFetching}
        right={
          <>
            <Link
              href="/okonomi/rediger"
              className="rounded-[10px] px-3.5 py-2 text-[13px] font-medium"
              style={{ border: `1px solid ${BC.border}`, color: BC.textDim, background: BC.card }}
            >
              Rediger
            </Link>
            <SegControl value={scope} onChange={setScope} />
          </>
        }
      />

      {query.isError ? (
        <div className="mt-6 text-[14px]" style={{ color: BC.red }}>
          {(query.error as Error).message}
        </div>
      ) : query.isLoading || !data ? (
        <Skeleton />
      ) : (
        <div className="mt-10 flex flex-col" style={{ gap: 40 }}>
          {worst && (
            <AlarmBar
              problem={`${worst.name}: ${worst.tempo.text}`}
              consequence="Budgettet risikerer at løbe tør før periodens slutning."
              action={{ label: `Åbn ${worst.name}`, href: `/okonomi/${worst.slug}` }}
            />
          )}

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <KpiTile label="Aftalt i alt" value={formatMoneyWhole(data.totals.aftalt)} context="For de igangværende perioder" />
            <KpiTile label="Brugt" value={formatMoneyWhole(data.totals.brugt)} context="Til og med i går" />
            <KpiTile label="Resterende" value={formatMoneyWhole(data.totals.rest)} context="Aftalt − brugt" />
            <KpiTile
              label="Skal bruges pr. dag"
              value={formatMoneyWhole(data.totals.skalPrDag)}
              accent
              context={`Kører nu: ${formatMoneyWhole(data.totals.koererNu)}/dag`}
            />
          </div>

          <section>
            <SectionTitle>Næste justeringer</SectionTitle>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.nextAdjustments.length === 0 ? (
                <p className="text-[13px]" style={{ color: BC.textGrey }}>
                  Ingen kommende justeringer.
                </p>
              ) : (
                data.nextAdjustments.map((adj, i) => <NextCard key={i} adj={adj} first={i === 0} />)
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Kunstnere</SectionTitle>
            <div className="rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}`, overflowX: "auto" }}>
              <table className="w-full text-left" style={{ minWidth: 1060 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BC.border}` }}>
                    {["Kunstner", "Periode", "Aftalt", "Brugt", "Rest", "Forbrug mod plan", "Pr. dag: nu / skal"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: BC.textGrey, textAlign: i >= 2 && i <= 4 ? "right" : "left" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.artists.map((a) => {
                    const nu = a.koererNu.amount;
                    const far = nu != null && a.skalPrDag != null && a.skalPrDag > 0 && Math.abs(nu - a.skalPrDag) / a.skalPrDag > 0.15;
                    return (
                      <tr key={a.slug} style={{ borderBottom: `1px solid ${BC.borderFaint}` }}>
                        <td className="px-4 py-3.5">
                          <Link href={`/okonomi/${a.slug}`} className="text-[15px] font-medium hover:underline" style={{ color: BC.text }}>
                            {a.name}
                          </Link>
                          {a.warningCount > 0 && (
                            <span className="ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium" style={{ color: BC.yellow, background: "rgba(217,164,65,0.14)" }}>
                              {a.warningCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[14px]" style={{ color: BC.textGrey }}>
                          {a.from ? `${ddmm(a.from)}–${ddmm(a.to)}` : "—"}
                        </td>
                        <td className="tnum px-4 py-3.5 text-right text-[15px]">{a.aftalt != null ? formatMoneyWhole(a.aftalt) : "—"}</td>
                        <td className="tnum px-4 py-3.5 text-right text-[15px]">{formatMoneyWhole(a.brugt)}</td>
                        <td className="tnum px-4 py-3.5 text-right text-[15px]">{a.rest != null ? formatMoneyWhole(a.rest) : "—"}</td>
                        <td className="px-4 py-3.5">
                          <PlanBar forbrugtPct={a.forbrugtPct} forventetPct={a.forventetPct} tempo={a.tempo} />
                        </td>
                        <td className="tnum px-4 py-3.5 text-[15px] whitespace-nowrap">
                          <span style={{ color: far ? TEMPO_HEX[a.tempo.status] : BC.text }}>{nu != null ? nf(nu) : "—"}</span>
                          <span style={{ color: BC.textFaint }}> / </span>
                          <span style={{ color: BC.textDim }}>{a.skalPrDag != null ? nf(a.skalPrDag) : "—"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionTitle>Advarsler{data.warnings.length > 0 ? ` (${data.warnings.length})` : ""}</SectionTitle>
            <WarningList warnings={data.warnings} />
          </section>
        </div>
      )}
    </div>
  );
}

function NextCard({ adj, first }: { adj: BudgetNextAdjustment; first: boolean }) {
  const dotColor = adj.kind === "budget" ? BC.orange : adj.kind === "payday" ? BC.yellow : BC.textGrey;
  return (
    <div className="rounded-[14px] p-5" style={{ background: BC.card, border: `1px solid ${first ? BC.orange : BC.border}` }}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: BC.textGrey }}>
        <span className="inline-block size-2 rounded-full" style={{ background: dotColor }} />
        {ddmm(adj.date)}
      </div>
      <div className="mt-3 text-[18px] font-semibold" style={{ color: BC.text }}>
        {adj.kind === "budget" ? (
          <span className="tnum">
            <span style={{ color: BC.textGrey }}>{adj.fromDaily != null ? nf(adj.fromDaily) : "—"}</span>
            <span style={{ color: BC.textFaint }}> → </span>
            {adj.toDaily != null ? nf(adj.toDaily) : "—"} kr./dag
          </span>
        ) : (
          adj.title
        )}
      </div>
      <div className="mt-1 text-[13px]" style={{ color: BC.textGrey }}>
        {adj.artistName}
      </div>
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

function Skeleton() {
  return (
    <div className="mt-10 flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}`, height: 132 }} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[14px]" style={{ background: BC.card, border: `1px solid ${BC.border}` }} />
    </div>
  );
}

export function AdminOnly() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center" style={{ color: BC.text }}>
      <h1 className="text-2xl font-semibold tracking-tight">Kun for administratorer</h1>
      <p className="mt-2 text-sm" style={{ color: BC.textGrey }}>
        Budgetsektionen er ikke tilgængelig for denne adgang.
      </p>
      <Link href="/" className="mt-5 text-sm hover:underline" style={{ color: BC.orange }}>
        Tilbage til oversigt
      </Link>
    </div>
  );
}
