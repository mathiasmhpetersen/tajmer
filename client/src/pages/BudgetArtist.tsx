import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { ARTISTS_BY_SLUG } from "@shared/artists";
import { fetchArtistBudget } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { formatMoney, formatMoneyWhole } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ddmm, ddmmyyyy, deriveArtistSummary, todayIso } from "@/lib/budget";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/States";
import { PaceChip, ProgressBar, WarningChips } from "@/components/budget/BudgetBits";
import { BudgetChart, type ChartPoint } from "@/components/budget/BudgetChart";
import { AdminOnly } from "./BudgetOverview";

export function BudgetArtist({ slug }: { slug: string }) {
  const isClient = useIsClient();
  const known = ARTISTS_BY_SLUG[slug];
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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ukendt kunstner</h1>
        <Link href="/budget" className="mt-5 text-sm text-accent hover:underline">
          Tilbage til budget
        </Link>
      </div>
    );
  }

  const b = query.data;
  const today = todayIso();
  const summary = b ? deriveArtistSummary(b) : null;

  const spendByDate = new Map((b?.dailySpend ?? []).map((p) => [p.date, p.spend]));
  const points: ChartPoint[] = (b?.dailyPlan ?? []).map((d) => ({
    date: d.date,
    planned: d.planned,
    spend: d.date <= today ? (spendByDate.get(d.date) ?? 0) : null,
    pause: d.pause,
  }));
  const chartEvents = (b?.events ?? []).flatMap((e) =>
    e.occurrences.map((date) => ({ date, title: e.title })),
  );

  const nextAdj =
    b?.adjustments
      .filter((a) => a.date && a.date >= today)
      .sort((x, y) => ((x.date as string) < (y.date as string) ? -1 : 1))[0] ?? null;

  const upcoming = (b?.events ?? [])
    .map((e) => ({
      e,
      next: [...e.occurrences].filter((d) => d >= today).sort()[0] ?? null,
    }))
    .filter((x) => x.next)
    .sort((a, z) => ((a.next as string) < (z.next as string) ? -1 : 1));

  return (
    <div>
      <PageHeader
        dateline={
          <Link href="/budget" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> Budget
          </Link>
        }
        title={known.name}
        actions={
          <Button variant="ghost" size="sm" loading={query.isFetching} onClick={refresh}>
            {!query.isFetching && <RefreshCw className="size-3.5" />} Opdater nu
          </Button>
        }
      />

      {query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={refresh} />
      ) : query.isLoading || !b || !summary ? (
        <div className="h-72 animate-pulse rounded-card border border-hairline bg-card" />
      ) : (
        <div className="flex flex-col gap-10">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Periodebudget"
              value={summary.periodBudget != null ? formatMoneyWhole(summary.periodBudget) : "—"}
              helper={
                summary.current
                  ? `${ddmm(summary.current.from)}–${ddmm(summary.current.to)}`
                  : "Ingen aktiv periode"
              }
              tone="accent"
            />
            <KpiCard label="Brugt" value={formatMoneyWhole(summary.spentInPeriod)} helper="I perioden" />
            <KpiCard
              label="Resterende"
              value={summary.remaining != null ? formatMoneyWhole(summary.remaining) : "—"}
              helper={summary.remaining != null && summary.remaining < 0 ? "Overforbrug" : undefined}
            />
            <div className="flex flex-col justify-between rounded-card border border-hairline bg-card p-5">
              <span className="text-sm text-muted">Tempo</span>
              <div className="mt-5">
                <PaceChip status={summary.status} pct={summary.tempoPct} />
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {summary.expectedToDate != null
                  ? `Forventet ${formatMoneyWhole(summary.expectedToDate)} til dato`
                  : "Ingen pace-data"}
              </p>
            </div>
          </div>

          {/* progress */}
          {summary.periodBudget != null && (
            <div className="rounded-card border border-hairline bg-card p-5">
              <div className="mb-3 flex items-baseline justify-between text-sm">
                <span className="text-muted">Forbrug i nuværende periode</span>
                <span className="tnum text-muted">
                  {formatMoney(summary.spentInPeriod)} / {formatMoneyWhole(summary.periodBudget)}
                </span>
              </div>
              <ProgressBar value={summary.spentInPeriod} max={summary.periodBudget} />
            </div>
          )}

          {/* chart */}
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Dagsbudget mod forbrug</h2>
            {points.length > 0 ? (
              <div className="rounded-card border border-hairline bg-card p-5">
                <BudgetChart points={points} events={chartEvents} today={today} />
              </div>
            ) : (
              <EmptyState message="Ingen budgetperioder i planen endnu." />
            )}
          </section>

          {/* next adjustment + adjustments table */}
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">Næste justering</h2>
              <div className="rounded-card border border-hairline bg-card p-5">
                {nextAdj ? (
                  <>
                    <div className="text-sm text-muted">{ddmmyyyy(nextAdj.date)}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="tnum text-xl font-semibold">
                        {nextAdj.fromDaily != null ? formatMoneyWhole(nextAdj.fromDaily) : "—"}
                      </span>
                      <DirArrow dir={nextAdj.direction} />
                      <span
                        className={cn(
                          "tnum text-xl font-semibold",
                          nextAdj.direction === "up"
                            ? "text-success"
                            : nextAdj.direction === "down"
                              ? "text-warning"
                              : "text-ink",
                        )}
                      >
                        {nextAdj.toDaily != null ? formatMoneyWhole(nextAdj.toDaily) : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-muted">Dagligt budget</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">Ingen planlagte justeringer.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">Alle justeringer</h2>
              {b.adjustments.length > 0 ? (
                <div className="overflow-hidden rounded-card border border-hairline">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hairline bg-card text-left text-[12px] uppercase tracking-wide text-faint">
                        <th className="px-4 py-2.5 font-medium">Dato</th>
                        <th className="px-4 py-2.5 text-right font-medium">Fra</th>
                        <th className="px-4 py-2.5 text-right font-medium">Til</th>
                        <th className="px-4 py-2.5 text-right font-medium">Retning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.adjustments.map((a, i) => (
                        <tr key={i} className="border-b border-hairline last:border-0">
                          <td className="px-4 py-2.5">{ddmmyyyy(a.date)}</td>
                          <td className="tnum px-4 py-2.5 text-right text-muted">
                            {a.fromDaily != null ? formatMoneyWhole(a.fromDaily) : "—"}
                          </td>
                          <td className="tnum px-4 py-2.5 text-right">
                            {a.toDaily != null ? formatMoneyWhole(a.toDaily) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end">
                              <DirArrow dir={a.direction} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">Ingen justeringer i planen.</p>
              )}
            </section>
          </div>

          {/* period timeline */}
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Perioder</h2>
            <div className="flex flex-col gap-2">
              {b.periods.map((p, i) => {
                const current = Boolean(p.from && p.to && p.from <= today && p.to >= today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                      current ? "border-accent/60 bg-card" : "border-hairline bg-card/60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="tnum text-sm font-medium">
                        {ddmm(p.from)}–{ddmm(p.to)}
                      </span>
                      {current && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                          Nu
                        </span>
                      )}
                      {p.type && <span className="text-[12px] text-faint">{p.type}</span>}
                      {p.pause && (
                        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-faint">
                          pause
                        </span>
                      )}
                    </div>
                    <div className="tnum flex items-center gap-4 text-sm">
                      <span className="text-muted">
                        {p.dailyBudget != null ? `${formatMoneyWhole(p.dailyBudget)}/dag` : p.note || "—"}
                      </span>
                      <span className="text-ink">
                        {p.periodBudget != null ? formatMoneyWhole(p.periodBudget) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {b.periods.length === 0 && <p className="text-sm text-muted">Ingen perioder.</p>}
            </div>
          </section>

          {/* upcoming events */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">Kommende tiltag</h2>
              <ul className="flex flex-col gap-2">
                {upcoming.map(({ e, next }, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-2 shrink-0 rounded-full bg-accent" />
                      <span className="font-medium">{e.title}</span>
                      {e.source && <span className="text-[12px] text-faint">{e.source}</span>}
                    </div>
                    <span className="tnum text-sm text-muted">{ddmmyyyy(next)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* warnings */}
          <section>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Advarsler{b.warnings.length > 0 ? ` (${b.warnings.length})` : ""}
            </h2>
            <WarningChips warnings={b.warnings} />
          </section>
        </div>
      )}
    </div>
  );
}

function DirArrow({ dir }: { dir: "up" | "down" | "none" }) {
  if (dir === "up") return <ArrowUp className="size-4 text-success" />;
  if (dir === "down") return <ArrowDown className="size-4 text-warning" />;
  return <ArrowRight className="size-4 text-faint" />;
}
