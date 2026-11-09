import { Link } from "wouter";
import { ArrowUpRight, ImageOff } from "lucide-react";
import type { ArtistSummary } from "@shared/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ArtistCard({ artist }: { artist: ArtistSummary }) {
  const idle = artist.activeAds === 0;
  return (
    <Link
      href={`/${artist.slug}`}
      className="group flex flex-col rounded-card border border-hairline bg-card p-5 transition-colors duration-150 hover:bg-card-2"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{artist.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {idle
              ? "Ingen aktive annoncer"
              : `${artist.activeAds} ${artist.activeAds === 1 ? "annonce" : "annoncer"} med forbrug`}
          </p>
        </div>
        <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-muted" />
      </div>

      <div
        className={cn(
          "tnum mt-5 text-[1.9rem] font-semibold leading-none tracking-tightest",
          idle ? "text-faint" : "text-accent",
        )}
      >
        {formatMoney(artist.spend)}
      </div>

      <div className="mt-5 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => {
          const url = artist.thumbnails[i];
          return (
            <div
              key={i}
              className="relative aspect-[4/5] flex-1 overflow-hidden rounded-lg bg-card-2"
            >
              {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-faint">
                  {i === 0 && idle && <ImageOff className="size-4" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Link>
  );
}
