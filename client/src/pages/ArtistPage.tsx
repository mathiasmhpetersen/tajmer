import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Link } from "wouter";
import type { Range } from "@shared/types";
import { ARTISTS_BY_SLUG } from "@shared/artists";
import { fetchArtist } from "@/lib/api";
import {
  formatCompact,
  formatMoney,
  formatMoneyWhole,
  formatNumber,
  formatToday,
} from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { RangeToggle } from "@/components/RangeToggle";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { AdCard } from "@/components/AdCard";
import { AdGridSkeleton, KpiRowSkeleton } from "@/components/Skeletons";
import { EmptyState, ErrorState } from "@/components/States";

const RANGE_NOUN: Record<Range, string> = {
  today: "i dag",
  yesterday: "i går",
  last_7d: "de sidste 7 dage",
};

export function ArtistPage({ slug }: { slug: string }) {
  const [range, setRange] = useState<Range>("today");
  const forceRef = useRef(false);
  const known = ARTISTS_BY_SLUG[slug];

  const query = useQuery({
    queryKey: ["artist", slug, range],
    queryFn: () => {
      const nocache = forceRef.current;
      forceRef.current = false;
      return fetchArtist(slug, range, nocache);
    },
    enabled: Boolean(known),
  });

  const refresh = () => {
    forceRef.current = true;
    query.refetch();
  };

  if (!known) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ukendt kunstner</h1>
        <p className="mt-2 text-sm text-muted">Siden "{slug}" findes ikke.</p>
        <Link href="/" className="mt-5 text-sm text-accent hover:underline">
          Tilbage til oversigt
        </Link>
      </div>
    );
  }

  const data = query.data;
  const noun = RANGE_NOUN[range];

  return (
    <div>
      <PageHeader
        dateline={formatToday()}
        title={known.name}
        meta={
          data
            ? `${formatNumber(data.activeAds)} aktive annoncer med forbrug ${noun} · ${formatMoney(
                data.totalSpend,
              )}`
            : `Aktive annoncer med forbrug ${noun}`
        }
        actions={
          <>
            <RangeToggle value={range} onChange={setRange} />
            <Button variant="ghost" size="sm" loading={query.isFetching} onClick={refresh}>
              {!query.isFetching && <RefreshCw className="size-3.5" />} Opdater nu
            </Button>
          </>
        }
      />

      {query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={refresh} />
      ) : query.isLoading || !data ? (
        <>
          <KpiRowSkeleton />
          <div className="mt-10">
            <AdGridSkeleton />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label={`Forbrug ${noun}`}
              value={formatMoneyWhole(data.totalSpend)}
              helper="Samlet annonceforbrug"
              tone="accent"
            />
            <KpiCard
              label="Aktive annoncer"
              value={formatNumber(data.activeAds)}
              helper={`I ${data.campaigns.length} ${
                data.campaigns.length === 1 ? "kampagne" : "kampagner"
              }`}
            />
            <KpiCard
              label="Eksponeringer"
              value={formatCompact(data.impressions)}
              helper={`${formatNumber(data.clicks)} klik`}
            />
            <KpiCard
              label="Resultater"
              value={data.results > 0 ? formatNumber(data.results) : "—"}
              helper={data.results > 0 ? "Konverteringer i perioden" : "Ingen målt endnu"}
              tone={data.results > 0 ? "success" : "default"}
            />
          </div>

          <div className="mt-10 flex flex-col gap-12">
            {data.campaigns.length === 0 ? (
              <EmptyState message={`Ingen aktive annoncer med forbrug ${noun}.`} />
            ) : (
              data.campaigns.map((campaign) => (
                <section key={campaign.campaignId}>
                  <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
                    <h2 className="truncate text-lg font-semibold tracking-tight">
                      {campaign.displayName}
                    </h2>
                    <span className="tnum shrink-0 text-sm text-muted">
                      {formatMoney(campaign.spend)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
                    {campaign.ads.map((ad) => (
                      <AdCard key={ad.adId} ad={ad} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
