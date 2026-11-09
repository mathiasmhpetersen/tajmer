import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Accent = "default" | "accent" | "success";

const valueTone: Record<Accent, string> = {
  default: "text-ink",
  accent: "text-accent",
  success: "text-success",
};

export interface KpiCardProps {
  label: string;
  value: string;
  helper?: string;
  tone?: Accent;
  href?: string;
}

/**
 * KPI tile from nordbirkvej: small grey label, very large tight-tracked value,
 * one grey helper line, tiny ↗ top-right.
 */
export function KpiCard({ label, value, helper, tone = "default", href }: KpiCardProps) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        "group relative flex flex-col justify-between rounded-card border border-hairline bg-card p-5",
        "transition-colors duration-150",
        href && "hover:bg-card-2",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted">{label}</span>
        <ArrowUpRight
          className={cn(
            "size-4 text-faint transition-colors",
            href && "group-hover:text-muted",
          )}
          aria-hidden
        />
      </div>
      <div
        className={cn(
          "tnum mt-6 text-[2.35rem] font-semibold leading-none tracking-tightest",
          valueTone[tone],
        )}
      >
        {value}
      </div>
      {helper && <p className="mt-2 text-[13px] text-muted">{helper}</p>}
    </Wrapper>
  );
}
