import { useEffect, useRef, useState } from "react";
import type { DailySpendPoint, PaydayMarker } from "@shared/budget";
import { formatMoney, formatMoneyWhole } from "@/lib/format";
import { BC, dm, ddmmyyyy } from "@/lib/budget";

const PLOT_H = 220;
const PAD = { top: 22, right: 16, bottom: 22, left: 46 };
const H = PLOT_H + PAD.top + PAD.bottom;

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

interface Day {
  date: string;
  value: number;
  future: boolean;
}

export function BudgetChart({
  from,
  to,
  today,
  dailySpend,
  koererNu,
  skalPrDag,
  tomDato,
  paydays,
}: {
  from: string;
  to: string;
  today: string;
  dailySpend: DailySpendPoint[];
  koererNu: number | null;
  skalPrDag: number | null;
  tomDato: string | null;
  paydays: PaydayMarker[];
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const spend = new Map(dailySpend.map((p) => [p.date, p.spend]));
  const days: Day[] = [];
  const DAY = 86_400_000;
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const future = date > today;
    let value: number;
    if (!future) value = spend.get(date) ?? 0;
    else if (tomDato && date > tomDato) value = 0; // money has run out
    else value = koererNu ?? 0;
    days.push({ date, value, future });
  }

  const n = days.length;
  const maxVal = Math.max(1, skalPrDag ?? 0, koererNu ?? 0, ...days.map((d) => d.value));
  const yMax = niceMax(maxVal);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const band = n > 0 ? plotW / n : 0;
  const barW = Math.max(2, band - 4);
  const xLeft = (i: number) => PAD.left + band * i;
  const xMid = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + PLOT_H * (1 - v / yMax);
  const yBase = y(0);

  const idx = new Map(days.map((d, i) => [d.date, i]));
  const todayIdx = idx.get(today);
  const tomIdx = tomDato && tomDato < to ? idx.get(tomDato) : undefined;
  const xTicks = n > 1 ? [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1] : [0];

  const Legend = (
    <div className="flex flex-wrap items-center gap-4 text-[12px]" style={{ color: BC.textGrey }}>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-sm" style={{ background: BC.orange }} /> Brugt
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-sm" style={{ background: BC.futureBar }} /> Hvis intet ændres
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: BC.green }} /> Råd til
      </span>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex justify-end">{Legend}</div>
      <div ref={ref} className="relative w-full select-none">
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Dagligt forbrug mod det, der er råd til">
            {[yMax, yMax / 2, 0].map((v, i) => (
              <g key={i}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={BC.borderFaint} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill={BC.textFaint}>
                  {v >= 1000 ? `${(v / 1000).toLocaleString("da-DK", { maximumFractionDigits: 1 })}k` : Math.round(v)}
                </text>
              </g>
            ))}

            {/* bars */}
            {days.map((d, i) =>
              d.value > 0 ? (
                <rect
                  key={i}
                  x={xMid(i) - barW / 2}
                  y={y(d.value)}
                  width={barW}
                  height={Math.max(0, yBase - y(d.value))}
                  rx={Math.min(3, barW / 2)}
                  fill={d.future ? BC.futureBar : BC.orange}
                  opacity={hover === i ? 1 : 0.92}
                />
              ) : null,
            )}

            {/* råd til line */}
            {skalPrDag != null && skalPrDag > 0 && skalPrDag <= yMax && (
              <g>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(skalPrDag)}
                  y2={y(skalPrDag)}
                  stroke={BC.green}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <text x={width - PAD.right} y={y(skalPrDag) - 5} textAnchor="end" fontSize={11} fill={BC.green}>
                  Råd til: {formatMoneyWhole(skalPrDag)}
                </text>
              </g>
            )}

            {/* payday ticks */}
            {paydays.map((pd, i) => {
              const pi = idx.get(pd.date);
              if (pi == null) return null;
              return (
                <line key={`p${i}`} x1={xMid(pi)} x2={xMid(pi)} y1={PAD.top} y2={yBase} stroke={BC.textFaint} strokeWidth={1} strokeDasharray="2 4" opacity={0.6}>
                  <title>Lønningsdag {dm(pd.date)}</title>
                </line>
              );
            })}

            {/* today marker */}
            {todayIdx != null && (
              <g>
                <line x1={xMid(todayIdx)} x2={xMid(todayIdx)} y1={PAD.top - 4} y2={yBase} stroke={BC.orange} strokeWidth={1.5} />
                <text x={xMid(todayIdx)} y={PAD.top - 8} textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing="0.08em" fill={BC.orange}>
                  I DAG
                </text>
              </g>
            )}

            {/* tom marker */}
            {tomIdx != null && (
              <g>
                <line x1={xMid(tomIdx)} x2={xMid(tomIdx)} y1={PAD.top - 4} y2={yBase} stroke={BC.red} strokeWidth={1.5} />
                <text x={xMid(tomIdx)} y={PAD.top - 8} textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing="0.08em" fill={BC.red}>
                  TOM {dm(tomDato)}
                </text>
              </g>
            )}

            {/* x labels */}
            {xTicks.map((i) => (
              <text key={`x${i}`} x={xMid(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={10} fill={BC.textFaint}>
                {dm(days[i].date)}
              </text>
            ))}

            {/* hover targets */}
            {days.map((_, i) => (
              <rect
                key={`h${i}`}
                x={xLeft(i)}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
            ))}
          </svg>
        )}

        {hover != null && days[hover] && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg px-3 py-2 text-[12px]"
            style={{ left: Math.min(Math.max(xMid(hover), 70), width - 70), top: 0, background: BC.card, border: `1px solid ${BC.border}` }}
          >
            <div className="font-medium" style={{ color: BC.text }}>
              {ddmmyyyy(days[hover].date)}
            </div>
            <div className="mt-0.5" style={{ color: BC.textGrey }}>
              {days[hover].future ? "Hvis intet ændres" : "Brugt"}: {formatMoney(days[hover].value)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
