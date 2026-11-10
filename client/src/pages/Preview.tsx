import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { ApproveItem, PreviewAd, PreviewArtistGroup } from "@shared/types";
import {
  approveAd,
  approveBulk,
  fetchPreview,
  resolveFeedback,
  sendFeedback,
} from "@/lib/api";
import { useIsClient } from "@/lib/session";
import { formatToday } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/preview/ConfirmButton";
import { PreviewAdCard } from "@/components/preview/PreviewAdCard";
import { AdFormatGroups } from "@/components/AdFormatGroups";
import { AdGridSkeleton } from "@/components/Skeletons";
import { EmptyState, ErrorState } from "@/components/States";

/** Ads that can still be approved (not yet godkendt, no open corrections). */
function approvable(group: PreviewArtistGroup): ApproveItem[] {
  return group.campaigns
    .flatMap((c) => c.ads)
    .filter((a) => a.status === "afventer")
    .map((a) => ({ adId: a.adId, creativeId: a.creativeId }));
}

export function Preview() {
  const isClient = useIsClient();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["preview"], queryFn: fetchPreview });
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["preview"] });

  const onApprove = async (ad: PreviewAd, approved: boolean) => {
    await approveAd(ad.adId, ad.creativeId, approved);
    await invalidate();
  };
  const onFeedback = async (ad: PreviewAd, text: string) => {
    await sendFeedback(ad.adId, ad.creativeId, text);
    await invalidate();
  };
  const onResolve = async (
    ad: PreviewAd,
    feedbackId: string,
    opts: { note?: string; fixedAdId?: string },
  ) => {
    await resolveFeedback(ad.adId, feedbackId, opts);
    await invalidate();
  };
  const runBulk = async (key: string, items: ApproveItem[]) => {
    if (items.length === 0) return;
    setBulkBusy(key);
    try {
      await approveBulk(items, true);
      await invalidate();
    } finally {
      setBulkBusy(null);
    }
  };

  const data = query.data;
  const allApprovable = data ? data.artists.flatMap(approvable) : [];

  return (
    <div>
      <PageHeader
        dateline={formatToday()}
        title="Preview"
        meta="Annoncer der venter på godkendelse før de går live"
        actions={
          <>
            {data && allApprovable.length > 0 && (
              <ConfirmButton
                label={`Godkend alle artister (${allApprovable.length})`}
                confirmLabel={`Godkend ${allApprovable.length} annoncer?`}
                loading={bulkBusy === "all"}
                onConfirm={() => runBulk("all", allApprovable)}
              />
            )}
            <Button variant="ghost" size="sm" loading={query.isFetching} onClick={() => invalidate()}>
              {!query.isFetching && <RefreshCw className="size-3.5" />} Opdater nu
            </Button>
          </>
        }
      />

      {query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => invalidate()} />
      ) : query.isLoading || !data ? (
        <AdGridSkeleton />
      ) : data.artists.length === 0 ? (
        <EmptyState message="Ingen annoncer venter på godkendelse lige nu." />
      ) : (
        <div className="flex flex-col gap-12">
          {data.artists.map((group) => {
            const items = approvable(group);
            return (
              <section key={group.slug}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
                  <h2 className="text-lg font-semibold tracking-tight">{group.name}</h2>
                  {items.length > 0 && (
                    <ConfirmButton
                      label={`Godkend alle (${items.length})`}
                      confirmLabel={`Godkend ${items.length} annoncer?`}
                      loading={bulkBusy === group.slug}
                      onConfirm={() => runBulk(group.slug, items)}
                    />
                  )}
                </div>

                {group.campaigns.map((campaign) => (
                  <div key={campaign.campaignId} className="mb-8 last:mb-0">
                    <h3 className="mb-4 text-sm font-medium text-muted">{campaign.displayName}</h3>
                    <AdFormatGroups
                      items={campaign.ads}
                      getAspect={(ad) => ad.preview.aspect}
                      getKey={(ad) => ad.adId}
                      render={(ad) => (
                        <PreviewAdCard
                          ad={ad}
                          isClient={isClient}
                          onApprove={onApprove}
                          onFeedback={onFeedback}
                          onResolve={onResolve}
                        />
                      )}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
