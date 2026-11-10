import { useEffect, useRef, useState } from "react";
import { formatMoney, formatMoneyWhole } from "@/lib/format";
import { ddmm, ddmmyyyy } from "@/lib/budget";

export interface ChartPoint {
  date: string; // ISO
  planned: number | null;
  spend: number | null;
  pause: boolean;
}

export interface ChartEvent {
  date: string;
  title: string;
}

const H = 260;
const PAD = { top: 26, right: 14, bottom: 24, left: 52 };

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Planned daily budget (stepped line) vs actual daily spend (bars) — one y-axis
 * (both are kr). A dashed muted line reads as the plan/target; accent bars are
 * the real spend. Today marker, event ticks on top, per-day hover tooltip.
 */
export function BudgetChart({
  points,
  events,
  today,
}: {
  points: ChartPoint[];
  events: ChartEvent[];
  today: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const n = points.length;
  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.planned ?? 0, p.spend ?? 0)),
  );
  const yMax = niceMax(maxVal);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const band = n > 0 ? plotW / n : 0;
  const barW = Math.max(2, Math.min(band * 0.56, 16));
  const xLeft = (i: number) => PAD.left + band * i;
  const xMid = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);
  const yBase = y(0);

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => yMax * f);
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  // Planned stepped path across each day's band width.
  let plannedPath = "";
  points.forEach((p, i) => {
    if (p.planned == null) return;
    const yv = y(p.planned);
    const l = xLeft(i);
    const r = xLeft(i + 1);
    plannedPath += plannedPath === "" ? `M ${l} ${yv} L ${r} ${yv}` : ` L ${l} ${yv} L ${r} ${yv}`;
  });

  const indexByDate = new Map(points.map((p, i) => [p.date, i]));
  const todayIndex = indexByDate.get(today);

  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Planlagt budget mod faktisk forbrug">
          {/* gridlines + y labels */}
          {gridValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className="stroke-hairline"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" className="fill-faint text-[10px]">
                {v >= 1000
                  ? `${(v / 1000).toLocaleString("da-DK", { maximumFractionDigits: 1 })}k`
                  : Math.round(v)}
              </text>
            </g>
          ))}

          {/* today marker */}
          {todayIndex != null && (
            <g>
              <line
                x1={xMid(todayIndex)}
                x2={xMid(todayIndex)}
                y1={PAD.top - 6}
                y2={yBase}
                className="stroke-faint"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={xMid(todayIndex)}
                y={PAD.top - 10}
                textAnchor="middle"
                className="fill-faint text-[10px]"
              >
                I dag
              </text>
            </g>
          )}

          {/* actual spend bars */}
          {points.map((p, i) =>
            p.spend != null && p.spend > 0 ? (
              <rect
                key={`b${i}`}
                x={xMid(i) - barW / 2}
                y={y(p.spend)}
                width={barW}
                height={Math.max(0, yBase - y(p.spend))}
                rx={Math.min(3, barW / 2)}
                className={hover === i ? "fill-accent" : "fill-accent/85"}
              />
            ) : null,
          )}

          {/* planned step line (the target) */}
          {plannedPath && (
            <path
              d={plannedPath}
              fill="none"
              className="stroke-ink/70"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
          )}

          {/* event ticks above the plot */}
          {events.map((ev, i) => {
            const idx = indexByDate.get(ev.date);
            if (idx == null) return null;
            return (
              <circle key={`e${i}`} cx={xMid(idx)} cy={PAD.top - 14} r={3} className="fill-accent">
                <title>{`${ddmm(ev.date)} · ${ev.title}`}</title>
              </circle>
            );
          })}

          {/* x labels */}
          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text
                key={`x${i}`}
                x={xMid(i)}
                y={H - 7}
                textAnchor="middle"
                className="fill-faint text-[10px]"
              >
                {ddmm(p.date)}
              </text>
            ) : null,
          )}

          {/* hover hit targets */}
          {points.map((_, i) => (
            <rect
              key={`h${i}`}
              x={xLeft(i)}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}
        </svg>
      )}

      {/* tooltip */}
      {hover != null && points[hover] && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg border border-hairline bg-card-2 px-3 py-2 text-[12px] shadow-lg"
          style={{ left: Math.min(Math.max(xMid(hover), 70), width - 70), top: 2 }}
        >
          <div className="font-medium text-ink">{ddmmyyyy(points[hover].date)}</div>
          <div className="mt-1 flex items-center gap-2 text-muted">
            <span className="inline-block h-0 w-3 border-t-2 border-dashed border-ink/70" />
            Planlagt: {points[hover].pause ? "Pause" : points[hover].planned != null ? formatMoneyWhole(points[hover].planned as number) : "—"}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-muted">
            <span className="inline-block size-2.5 rounded-sm bg-accent" />
            Brugt: {points[hover].spend != null ? formatMoney(points[hover].spend as number) : "—"}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="mt-2 flex items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent" /> Faktisk forbrug
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-ink/70" /> Planlagt dagsbudget
        </span>
      </div>
    </div>
  );
}
