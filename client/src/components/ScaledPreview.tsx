import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// The Meta preview is rendered at its native size (feed card = 400×640, vertical
// Story = 360×640) and the wrapper is scaled down to the card width — never up —
// so the whole ad is visible and nothing is cropped.
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 640;

export function ScaledPreview({
  src,
  title,
  nativeWidth = DEFAULT_WIDTH,
  nativeHeight = DEFAULT_HEIGHT,
  className,
}: {
  src: string;
  title: string;
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
    ro.observe(el);
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
  }, [nativeWidth]);

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
            allow="autoplay; encrypted-media"
            className="block border-0"
          />
        </div>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-black/[0.04] motion-reduce:animate-none" />
      )}
    </div>
  );
}
