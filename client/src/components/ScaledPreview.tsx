import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// The Meta MOBILE_FEED_STANDARD preview needs ~400px of width to show the whole
// card (close X, CTA, like/comment/share). We render the iframe at a fixed
// native 400×640 and scale the wrapper down to the card width — never up.
export const PREVIEW_NATIVE_WIDTH = 400;
export const PREVIEW_NATIVE_HEIGHT = 640;

export function ScaledPreview({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
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
      if (w > 0) setScale(Math.min(1, w / PREVIEW_NATIVE_WIDTH));
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
  }, []);

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative mx-auto w-full max-w-[400px] overflow-hidden rounded-xl bg-white",
        className,
      )}
      style={{ aspectRatio: `${PREVIEW_NATIVE_WIDTH} / ${PREVIEW_NATIVE_HEIGHT}` }}
    >
      {inView ? (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: PREVIEW_NATIVE_WIDTH,
            height: PREVIEW_NATIVE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <iframe
            title={title}
            src={src}
            width={PREVIEW_NATIVE_WIDTH}
            height={PREVIEW_NATIVE_HEIGHT}
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
