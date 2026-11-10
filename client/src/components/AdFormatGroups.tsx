import { Fragment } from "react";
import type { MediaAspect } from "@shared/types";
import { cn } from "@/lib/cn";

/**
 * Masonry (CSS columns) so cards of different native heights pack without the
 * ragged rows a fixed grid would leave.
 */
function Masonry({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "columns-[340px] gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Splits ads by aspect and renders standard formats first, then all 9:16
 * portrait ads in their own block at the bottom so the tall cards don't break
 * up the grid of the others.
 */
export function AdFormatGroups<T>({
  items,
  getAspect,
  getKey,
  render,
}: {
  items: T[];
  getAspect: (item: T) => MediaAspect;
  getKey: (item: T) => string;
  render: (item: T) => React.ReactNode;
}) {
  const standard = items.filter((i) => getAspect(i) !== "portrait");
  const portrait = items.filter((i) => getAspect(i) === "portrait");

  return (
    <>
      {standard.length > 0 && (
        <Masonry>
          {standard.map((i) => (
            <Fragment key={getKey(i)}>{render(i)}</Fragment>
          ))}
        </Masonry>
      )}
      {portrait.length > 0 && (
        <Masonry className={standard.length > 0 ? "mt-6" : undefined}>
          {portrait.map((i) => (
            <Fragment key={getKey(i)}>{render(i)}</Fragment>
          ))}
        </Masonry>
      )}
    </>
  );
}
