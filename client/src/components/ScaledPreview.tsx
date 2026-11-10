import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Feed cards (4:5 / 1:1 / 16:9) are responsive, so we let the iframe fill the
// card at its native size (no scaling — avoids the "zoomed out" look). Vertical
// 9:16 Story previews have a fixed 360×640 layout, so those we render at native
// size and scale the wrapper down to the card width — never up.
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 640;
// autoplay is intentionally omitted so videos don't play automatically — the
// browser then shows Meta's play button.
const IFRAME_ALLOW = "encrypted-media";

export function ScaledPreview({
  src,
  title,
  vertical = false,
  nativeWidth = DEFAULT_WIDTH,
  nativeHeight = DEFAULT_HEIGHT,
  className,
}: {
  src: string;
  title: string;
  vertical?: boolean;
  nativeWidth?: number;
  nativeHeight?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setScale(Math.min(1, w / nativeWidth));
    });
    if (vertical) ro.observe(el);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [nativeWidth, vertical]);

  const skeleton = (
    <div className="absolute inset-0 animate-pulse bg-black/[0.04] motion-reduce:animate-none" />
  );

  // Feed: the iframe fills the card at native size.
  if (!vertical) {
    return (
      <div
        ref={boxRef}
        className={cn("relative w-full overflow-hidden rounded-xl bg-white", className)}
        style={{ aspectRatio: `${nativeWidth} / ${nativeHeight}` }}
      >
        {inView ? (
          <iframe
            title={title}
            src={src}
            scrolling="no"
            loading="lazy"
            allow={IFRAME_ALLOW}
            className="absolute inset-0 block h-full w-full border-0"
          />
        ) : (
          skeleton
        )}
      </div>
    );
  }

  // Vertical 9:16 Story: native 360×640 scaled down to the card, centered.
  return (
    <div
      ref={boxRef}
      className={cn("relative mx-auto w-full overflow-hidden rounded-xl bg-white", className)}
      style={{ maxWidth: nativeWidth, aspectRatio: `${nativeWidth} / ${nativeHeight}` }}
    >
      {inView ? (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${scale})` }}
        >
          <iframe
            title={title}
            src={src}
            width={nativeWidth}
            height={nativeHeight}
            scrolling="no"
            loading="lazy"
            allow={IFRAME_ALLOW}
            className="block border-0"
          />
        </div>
      ) : (
        skeleton
      )}
    </div>
  );
}
