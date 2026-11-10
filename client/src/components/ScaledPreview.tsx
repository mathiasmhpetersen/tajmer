import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";

// The feed preview renders at Meta's native 335px feed width (full size), and we
// scale the wrapper down to the column width only when it's narrower — never up.
const DEFAULT_WIDTH = 335;
const DEFAULT_HEIGHT = 620;
// autoplay is intentionally omitted so videos don't play automatically — the
// browser then shows Meta's play button.
const IFRAME_ALLOW = "encrypted-media";

export function ScaledPreview({
  src,
  title,
  vertical = false,
  poster,
  videoUrl,
  nativeWidth = DEFAULT_WIDTH,
  nativeHeight = DEFAULT_HEIGHT,
  className,
}: {
  src: string;
  title: string;
  vertical?: boolean;
  poster?: string | null;
  videoUrl?: string | null;
  nativeWidth?: number;
  nativeHeight?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scale, setScale] = useState(1);
  const [inView, setInView] = useState(false);
  // Vertical Story previews auto-play (muted) on load, which an iframe `allow`
  // can't prevent — so for those we show a poster + play button and only mount
  // the live iframe once the user clicks.
  const [playing, setPlaying] = useState(false);
  // The Story iframe takes ~2s to render; keep the poster underneath and fade
  // the iframe in on load so there's no gray flash.
  const [loaded, setLoaded] = useState(false);

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
  }, [nativeWidth, vertical]);

  const skeleton = (
    <div className="absolute inset-0 animate-pulse bg-black/[0.04] motion-reduce:animate-none" />
  );

  // Feed: render the iframe at its native size and scale the wrapper down to the
  // column, so the whole card is visible (never clipped).
  if (!vertical) {
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

  // Vertical 9:16 with a direct video URL: play it natively in-place (like the
  // reference tools do) — the thumbnail is the <video> poster, so it shows
  // instantly, streams fast, and pauses for real. No Story iframe, no "jump".
  if (videoUrl) {
    return (
      <div
        ref={boxRef}
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-xl bg-black",
          className,
        )}
        style={{ maxWidth: nativeWidth, aspectRatio: `${nativeWidth} / ${nativeHeight}` }}
      >
        {inView ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster ?? undefined}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          skeleton
        )}
        {inView && !playing && (
          <button
            type="button"
            onClick={() => videoRef.current?.play()}
            aria-label="Afspil"
            className="group absolute inset-0 flex items-center justify-center"
          >
            <span className="relative flex size-16 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Play className="size-7 translate-x-0.5 fill-white text-white" />
            </span>
          </button>
        )}
        {inView && playing && (
          <button
            type="button"
            onClick={() => videoRef.current?.pause()}
            aria-label="Pause"
            className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform hover:scale-105 motion-reduce:transition-none"
          >
            <Pause className="size-4 fill-white" />
          </button>
        )}
      </div>
    );
  }

  // Vertical 9:16 Story (no direct video, e.g. image ads): poster + play button
  // until clicked, then the native 360×640 iframe scaled down to the card, with
  // a pause button that unmounts it (Meta's player can't be paused directly, so
  // pause returns to the poster).
  return (
    <div
      ref={boxRef}
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-xl bg-neutral-200",
        className,
      )}
      style={{ maxWidth: nativeWidth, aspectRatio: `${nativeWidth} / ${nativeHeight}` }}
    >
      {!inView ? (
        skeleton
      ) : playing ? (
        <>
          {/* Poster stays behind the iframe until it has loaded — no gray flash. */}
          {poster && (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div
            className={cn(
              "absolute left-0 top-0 origin-top-left transition-opacity duration-300 motion-reduce:transition-none",
              loaded ? "opacity-100" : "opacity-0",
            )}
            style={{ width: nativeWidth, height: nativeHeight, transform: `scale(${scale})` }}
          >
            <iframe
              title={title}
              src={src}
              width={nativeWidth}
              height={nativeHeight}
              scrolling="no"
              allow={IFRAME_ALLOW}
              onLoad={() => setLoaded(true)}
              className="block border-0"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setLoaded(false);
            }}
            aria-label="Pause"
            className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform hover:scale-105 motion-reduce:transition-none"
          >
            <Pause className="size-4 fill-white" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setLoaded(false);
            setPlaying(true);
          }}
          aria-label="Afspil"
          className="group absolute inset-0 flex items-center justify-center"
        >
          {poster && (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="relative flex size-16 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform group-hover:scale-105 motion-reduce:transition-none">
            <Play className="size-7 translate-x-0.5 fill-white text-white" />
          </span>
        </button>
      )}
    </div>
  );
}
