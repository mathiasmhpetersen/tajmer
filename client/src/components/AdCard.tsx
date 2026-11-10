import { ExternalLink, Play, Copy, AlertTriangle } from "lucide-react";
import type { AdItem } from "@shared/types";
import { formatCompact, formatMoney } from "@/lib/format";
import { useIsClient } from "@/lib/session";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { ScaledPreview } from "./ScaledPreview";
import { ctaLabel } from "@/lib/cta";

const FRAME_WIDTH = 400;

/**
 * The real Meta MOBILE_FEED_STANDARD preview at its native 400px width, scaled
 * down to the card — so the whole card (close X, CTA, like/comment/share) is
 * always visible, never cropped.
 */
function AdPreviewFrame({ ad }: { ad: AdItem }) {
  if (!ad.preview.iframeSrc) return <FeedFallback ad={ad} />;
  return (
    <ScaledPreview
      src={ad.preview.iframeSrc}
      title={ad.adName}
      nativeWidth={ad.preview.previewWidth}
      nativeHeight={ad.preview.previewHeight}
    />
  );
}

/** Our own feed-style card, used when the Graph preview edge fails (§4). */
function FeedFallback({ ad }: { ad: AdItem }) {
  const { preview } = ad;
  return (
    <div
      className="mx-auto flex flex-col overflow-hidden rounded-tile border border-black/10 bg-white text-[#050505]"
      style={{ width: "100%", maxWidth: FRAME_WIDTH }}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="size-9 rounded-full bg-[#dfe1e6]" />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">Tajmer Booking</div>
          <div className="text-[11px] text-[#65676b]">Sponsoreret</div>
        </div>
      </div>
      {preview.body && (
        <p className="px-3 pb-2 text-[13px] leading-snug text-[#050505] line-clamp-3">
          {preview.body}
        </p>
      )}
      <div className="relative aspect-[4/5] w-full bg-[#e9eaed]">
        {preview.thumbnailUrl && (
          <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        {preview.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/45">
              <Play className="size-6 translate-x-0.5 fill-white text-white" />
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 bg-[#f0f2f5] px-3 py-2.5">
        <div className="min-w-0">
          {preview.title && (
            <div className="truncate text-[13px] font-semibold text-[#050505]">
              {preview.title}
            </div>
          )}
          <div className="truncate text-[11px] uppercase tracking-wide text-[#65676b]">
            tajmer.dk
          </div>
        </div>
        {preview.ctaType && (
          <span className="shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-medium text-[#050505]">
            {ctaLabel(preview.ctaType)}
          </span>
        )}
      </div>
    </div>
  );
}

export function AdCard({ ad }: { ad: AdItem }) {
  const typeLabel = ad.preview.isVideo ? "VIDEO" : "BILLEDE";
  const isClient = useIsClient();

  return (
    <div className="flex flex-col gap-2.5">
      {/* Ad name + flags, above the card. Flags are internal-only. */}
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0 truncate text-[13px] font-semibold">
          <span className="text-faint">{typeLabel}</span>
          <span className="mx-1.5 text-faint">|</span>
          <span className="text-ink">{ad.adName}</span>
        </div>
        {!isClient && (
          <div className="flex shrink-0 items-center gap-1.5">
            {ad.flags.duplicate && (
              <Badge tone="warning">
                <Copy className="size-3" /> Dublet
              </Badge>
            )}
            {ad.flags.checkCopy && (
              <Badge tone="warning" className="whitespace-nowrap">
                <AlertTriangle className="size-3" /> Tjek copy
              </Badge>
            )}
          </div>
        )}
      </div>

      <AdPreviewFrame ad={ad} />

      {!isClient && (
        <>
          {/* Metrics line */}
          <div className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-[13px] text-muted">
            <span className="font-semibold text-ink">{formatMoney(ad.spend)}</span>
            <span className="text-faint">·</span>
            <span>{formatCompact(ad.impressions)} imp.</span>
            <span className="text-faint">·</span>
            <span>{formatCompact(ad.clicks)} klik</span>
            {ad.results != null && ad.results > 0 && (
              <>
                <span className="text-faint">·</span>
                <span className="text-success">{formatCompact(ad.results)} resultater</span>
              </>
            )}
          </div>

          <div className="px-0.5">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() =>
                ad.adsManagerUrl && window.open(ad.adsManagerUrl, "_blank", "noopener")
              }
            >
              <ExternalLink className="size-3.5" /> Åbn i Ads Manager
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
