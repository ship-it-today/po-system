"use client";

import { useId, useState } from "react";

export type StackedSeries = { key: string; label: string; color: string };
export type StackedDatum = { label: string; values: Record<string, number>; counts?: Record<string, number> };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/**
 * Stacked column chart: amounts per period, one segment per status.
 * Thin marks, 2px surface gaps between segments and bars, per-bar hover tooltip,
 * legend + direct totals above bars, recessive grid.
 */
export default function StackedBars({
  data,
  series,
  height = 260,
}: {
  data: StackedDatum[];
  series: StackedSeries[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const W = 720;
  const H = height;
  const padL = 56;
  const padR = 12;
  const padT = 28;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const totals = data.map((d) => series.reduce((s, sr) => s + (d.values[sr.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const step = niceStep(max);
  const yMax = Math.ceil(max / step) * step;
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(44, slot * 0.6);
  const gap = 2;

  const ticks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v);

  const hovered = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-4 mb-2 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Purchase order amounts by period and status</title>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#64748b">
              {compact(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = padL + slot * i + (slot - barW) / 2;
          let cursor = 0;
          const isHover = hover === i;
          return (
            <g
              key={d.label}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              style={{ outline: "none" }}
            >
              {/* hit area wider than the mark */}
              <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              {series.map((s, si) => {
                const v = d.values[s.key] || 0;
                if (v <= 0) return null;
                const y1 = y(cursor + v);
                const y0 = y(cursor);
                cursor += v;
                const h = Math.max(0, y0 - y1 - (si > 0 ? gap : 0));
                const isTop = cursor === totals[i];
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y1}
                    width={barW}
                    height={h}
                    rx={isTop ? 3 : 0}
                    fill={s.color}
                    opacity={isHover ? 0.85 : 1}
                  />
                );
              })}
              {totals[i] > 0 && (
                <text x={x + barW / 2} y={y(totals[i]) - 5} textAnchor="middle" fontSize={10} fill="#334155">
                  {compact(totals[i])}
                </text>
              )}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && hover != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((padL + slot * hover + slot / 2) / W) * 100}%`,
            top: 24,
            transform: hover > n / 2 ? "translateX(-105%)" : "translateX(8px)",
          }}
        >
          <div className="font-medium text-slate-900 mb-1">{hovered.label}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 py-0.5">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              <span className="font-semibold text-slate-900 tabular-nums">{fmt(hovered.values[s.key] || 0)}</span>
              <span className="text-slate-500">
                {s.label}
                {hovered.counts ? ` (${hovered.counts[s.key] || 0})` : ""}
              </span>
            </div>
          ))}
          <div className="mt-1 border-t border-slate-100 pt-1 text-slate-600">
            Total <span className="font-semibold text-slate-900 tabular-nums">{fmt(totals[hover])}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 3 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * pow;
}

function compact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(n)}`;
}
