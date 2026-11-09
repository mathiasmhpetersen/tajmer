import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { Range } from "@shared/types";
import { ARTISTS } from "@shared/artists";
import { fetchOverview } from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { cn } from "@/lib/cn";
import { formatMoneyWhole, formatNumber, formatToday } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { RangeToggle } from "@/components/RangeToggle";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { ArtistCard } from "@/components/ArtistCard";
import { KpiRowSkeleton, ArtistGridSkeleton } from "@/components/Skeletons";
import { ErrorState } from "@/components/States";

export function Overview() {
  const [range, setRange] = useState<Range>("today");
  const forceRef = useRef(false);
  const isClient = useIsClient();

  const query = useQuery({
    queryKey: ["overview", range],
    queryFn: () => {
      const nocache = forceRef.current;
      forceRef.current = false;
      return fetchOverview(range, nocache);
    },
  });

  const refresh = () => {
    forceRef.current = true;
    query.refetch();
  };

  const data = query.data;

  return (
    <div>
      <PageHeader
        dateline={formatToday()}
        title={
          isClient ? (
            "Aktive annoncer"
          ) : (
            <>
              Hej Mathias <span className="align-middle">👋</span>
            </>
          )
        }
        meta={`${isClient ? "På tværs af" : "Aktive annoncer på tværs af"} ${
          ARTISTS.length
        } ${isClient ? "artister" : "kunstnere"}`}
        actions={
          <>
            {!isClient && <RangeToggle value={range} onChange={setRange} />}
            <Button
              variant="ghost"
              size="sm"
              loading={query.isFetching}
              onClick={refresh}
            >
              {!query.isFetching && <RefreshCw className="size-3.5" />} Opdater nu
            </Button>
          </>
        }
      />

      {query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={refresh} />
      ) : (
        <>
          {!isClient &&
            (query.isLoading || !data ? (
              <KpiRowSkeleton />
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                  label="Forbrug i dag"
                  value={formatMoneyWhole(data.totalSpend)}
                  helper="På tværs af alle kunstnere"
                  tone="accent"
                />
                <KpiCard
                  label="Aktive annoncer"
                  value={formatNumber(data.activeAds)}
                  helper="Med forbrug i perioden"
                />
                <KpiCard
                  label="Kampagner i gang"
                  value={formatNumber(data.campaignsRunning)}
                  helper="Aktive kampagner med forbrug"
                />
                <KpiCard
                  label="Største forbrug"
                  value={data.biggestSpender?.name ?? "—"}
                  helper={
                    data.biggestSpender
                      ? formatMoneyWhole(data.biggestSpender.spend)
                      : "Ingen forbrug endnu"
                  }
                  tone="success"
                  href={data.biggestSpender ? `/${data.biggestSpender.slug}` : undefined}
                />
              </div>
            ))}

          <h2
            className={cn(
              "mb-4 text-sm font-semibold uppercase tracking-wider text-faint",
              isClient ? "mt-2" : "mt-10",
            )}
          >
            {isClient ? "Artister" : "Kunstnere"}
          </h2>

          {query.isLoading || !data ? (
            <ArtistGridSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.artists.map((artist) => (
                <ArtistCard key={artist.slug} artist={artist} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
