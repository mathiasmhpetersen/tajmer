import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { fetchBudgetOverview } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { formatMoney, formatMoneyWhole, formatToday } from "@/lib/format";
import { ddmm } from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/States";
import { PaceChip, ProgressBar, WarningChips } from "@/components/budget/BudgetBits";

export function BudgetOverview() {
  const isClient = useIsClient();
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
  const totalBudget =
    data?.artists.reduce((s, a) => s + (a.periodBudgetTotal ?? 0), 0) ?? 0;
  const totalSpent = data?.artists.reduce((s, a) => s + a.spentTotal, 0) ?? 0;

  return (
    <div>
      <PageHeader
        dateline={formatToday()}
        title="Budget"
        meta="Planlagt budget mod faktisk forbrug pr. kunstner"
        actions={
          <Button variant="ghost" size="sm" loading={query.isFetching} onClick={refresh}>
            {!query.isFetching && <RefreshCw className="size-3.5" />} Opdater nu
          </Button>
        }
      />

      {query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={refresh} />
      ) : query.isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-card border border-hairline bg-card" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard label="Periodebudget i alt" value={formatMoneyWhole(totalBudget)} tone="accent" />
            <KpiCard label="Brugt i alt" value={formatMoneyWhole(totalSpent)} />
            <KpiCard
              label="Resterende"
              value={formatMoneyWhole(Math.max(0, totalBudget - totalSpent))}
              helper={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% brugt` : undefined}
            />
          </div>

          <div className="mt-10 overflow-hidden rounded-card border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-card text-left text-[12px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3 font-medium">Kunstner</th>
                  <th className="px-4 py-3 font-medium">Nuværende periode</th>
                  <th className="px-4 py-3 text-right font-medium">Periodebudget</th>
                  <th className="px-4 py-3 text-right font-medium">Brugt</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Forbrug</th>
                  <th className="px-4 py-3 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {data.artists.map((a) => (
                  <tr key={a.slug} className="border-b border-hairline last:border-0 hover:bg-card">
                    <td className="px-4 py-3">
                      <Link href={`/budget/${a.slug}`} className="font-medium text-ink hover:text-accent">
                        {a.name}
                      </Link>
                      {a.warningCount > 0 && (
                        <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                          {a.warningCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {a.currentPeriod
                        ? `${ddmm(a.currentPeriod.from)}–${ddmm(a.currentPeriod.to)}${a.currentPeriod.pause ? " · pause" : ""}`
                        : "—"}
                    </td>
                    <td className="tnum px-4 py-3 text-right">
                      {a.periodBudgetTotal != null ? formatMoneyWhole(a.periodBudgetTotal) : "—"}
                    </td>
                    <td className="tnum px-4 py-3 text-right">{formatMoney(a.spentTotal)}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <ProgressBar value={a.spentTotal} max={a.periodBudgetTotal} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PaceChip status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Advarsler{data.warnings.length > 0 ? ` (${data.warnings.length})` : ""}
            </h2>
            <WarningChips warnings={data.warnings} />
          </section>
        </>
      )}
    </div>
  );
}

export function AdminOnly() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Kun for administratorer</h1>
      <p className="mt-2 text-sm text-muted">Budgetsektionen er ikke tilgængelig for denne adgang.</p>
      <Link href="/" className="mt-5 text-sm text-accent hover:underline">
        Tilbage til oversigt
      </Link>
    </div>
  );
}
