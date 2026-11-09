import { Skeleton } from "./ui/Skeleton";

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-card border border-hairline bg-card p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-7 h-9 w-28" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ArtistGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-card border border-hairline bg-card p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-5 h-7 w-28" />
          <div className="mt-5 flex gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="aspect-[4/5] flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mx-auto h-[620px] w-full max-w-[335px] rounded-tile" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
