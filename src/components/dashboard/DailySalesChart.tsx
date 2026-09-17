import React, { useId, useMemo, useState } from 'react';
import { BarChart3, List } from 'lucide-react';

/**
 * Day-wise sales, as a column chart.
 *
 * Replaces a three-column grid of cards, one per day, each carrying its own
 * miniature progress bar. That layout answered "what did the 4th take?" and
 * nothing else: the days sat in reading order rather than on a shared scale, so
 * the shape of a week - which day is quiet, whether trade is climbing - could
 * not be seen at all. Columns on one baseline show it at a glance.
 *
 * One series, so no legend: the heading already says what is plotted. The list
 * is kept behind a toggle, because a chart is not a substitute for the exact
 * figures and every value has to stay reachable without a pointer.
 */

export interface DailyTrend {
  date: string;
  orders_count: number;
  sales_paisa: number;
  refunded_paisa?: number;
}

interface DailySalesChartProps {
  trends: DailyTrend[];
  /** Full precision for a tooltip; the compact form is for the axis. */
  formatTaka: (paisa: number) => { compact: string; full: string };
}

/** Chart geometry, in px. Kept together so the SVG and the axis agree. */
const H = 168;
const TOP_PAD = 18;
const BAR_MAX_W = 24;
const BAR_GAP = 2;
/* A column may spread this wide before the group starts centring instead. Without
   a cap, seven days sat as seven thin bars against 638px of empty plot. */
const COL_MAX_W = 72;
const AXIS_W = 46;

/**
 * Axis ticks on round numbers, the top one at or above the tallest column.
 *
 * Stopping at the last tick below the maximum is what makes a bar overshoot its
 * own axis: a peak of 875 against ticks ending at 500 drew the column a third
 * taller than the plot, so it was cropped at the top edge and took its value
 * label off the chart with it.
 */
function niceTicks(maxPaisa: number): number[] {
  if (maxPaisa <= 0) return [0];
  const rough = maxPaisa / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10;
  const ticks: number[] = [0];
  while (ticks[ticks.length - 1] < maxPaisa) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export const DailySalesChart: React.FC<DailySalesChartProps> = ({ trends, formatTaka }) => {
  const [view, setView] = useState<'chart' | 'list'>('chart');
  const [hovered, setHovered] = useState<number | null>(null);
  const headingId = useId();

  const max = useMemo(() => Math.max(...trends.map((t) => t.sales_paisa), 1), [trends]);
  const ticks = useMemo(() => niceTicks(max), [max]);
  const axisMax = ticks[ticks.length - 1] || 1;
  const peakIndex = useMemo(
    () => trends.reduce((best, t, i) => (t.sales_paisa > trends[best].sales_paisa ? i : best), 0),
    [trends]
  );

  const dayLabel = (iso: string, long = false) =>
    new Date(iso).toLocaleDateString('en-US',
      long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });

  /*
   * A single day is not a chart. One column carries no comparison, so the
   * figure itself is the honest form.
   */
  if (trends.length === 1) {
    const only = trends[0];
    const money = formatTaka(only.sales_paisa);
    return (
      <div className="flex items-baseline gap-4 px-1 py-2">
        <div>
          <div className="text-ui-2xs text-jungle-teal-600 font-sans">{dayLabel(only.date, true)}</div>
          <div className="text-4xl font-extrabold text-jungle-teal-900 font-mono" title={money.full}>
            {money.compact}
          </div>
        </div>
        <div className="text-ui-xs text-jungle-teal-600 font-mono">
          {only.orders_count} {only.orders_count === 1 ? 'invoice' : 'invoices'}
        </div>
      </div>
    );
  }

  const active = hovered !== null ? trends[hovered] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p id={headingId} className="text-ui-2xs text-jungle-teal-600 font-sans">
          Sales per day · peak {formatTaka(max).compact}
        </p>
        {/* Every value stays reachable without a pointer. */}
        <div className="flex items-center gap-1 bg-jungle-teal-100 rounded-lg p-0.5">
          {(['chart', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              title={v === 'chart' ? 'Chart view' : 'List view'}
              className={`px-2 py-1 rounded-md transition-colors ${
                view === v ? 'bg-white text-jungle-teal-900 shadow-2xs' : 'text-jungle-teal-600 hover:text-jungle-teal-900'
              }`}
            >
              {v === 'chart' ? <BarChart3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-jungle-teal-200">
          <table className="w-full text-ui-xs">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 font-mono text-ui-2xs uppercase sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left">Date</th>
                <th className="px-3 py-1.5 text-right">Invoices</th>
                <th className="px-3 py-1.5 text-right">Gross Sales</th>
                <th className="px-3 py-1.5 text-right">Refund</th>
                <th className="px-3 py-1.5 text-right">Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono">
              {trends.map((t) => {
                const refund = t.refunded_paisa || 0;
                const net = t.sales_paisa - refund;
                return (
                  <tr key={t.date} className="hover:bg-jungle-teal-50">
                    <td className="px-3 py-1.5 text-jungle-teal-800">{t.date}</td>
                    <td className="px-3 py-1.5 text-right text-jungle-teal-600">{t.orders_count}</td>
                    <td className="px-3 py-1.5 text-right text-jungle-teal-600" title={formatTaka(t.sales_paisa).full}>
                      {formatTaka(t.sales_paisa).compact}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${refund > 0 ? 'text-rose-600' : 'text-jungle-teal-600'}`} title={formatTaka(refund).full}>
                      {refund > 0 ? `-${formatTaka(refund).compact}` : formatTaka(0).compact}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-jungle-teal-900" title={formatTaka(net).full}>
                      {formatTaka(net).compact}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/*
            Y axis. Round numbers, hairline rules, both recessive - and pinned to
            the plot's own height, so the baseline rule stops at the baseline
            instead of drawing itself across the readout underneath.
          */}
          <div className="absolute left-0 right-0 top-0 pointer-events-none"
               style={{ height: H, paddingTop: TOP_PAD }}>
            {ticks.map((v) => (
              <div
                key={v}
                className="absolute left-0 right-0 flex items-center gap-2"
                style={{ bottom: `${(v / axisMax) * (H - TOP_PAD)}px` }}
              >
                {/* No currency mark on the ticks: the heading says what is
                    plotted, and "৳ 2,000" wrapped to two lines in the gutter. */}
                <span
                  className="shrink-0 text-right font-mono text-[9.5px] text-jungle-teal-500 -translate-y-1/2 whitespace-nowrap"
                  style={{ width: AXIS_W - 8 }}
                >
                  {v === 0 ? '0' : formatTaka(v).compact.replace(/^৳\s*/, '')}
                </span>
                <span className="flex-1 border-t border-jungle-teal-200" />
              </div>
            ))}
          </div>

          {/* Columns and their labels scroll together, as one strip. */}
          <div className="overflow-x-auto" style={{ paddingLeft: AXIS_W }}>
            <div
              className="flex items-end justify-center"
              style={{ height: H, gap: BAR_GAP, minWidth: trends.length * (BAR_GAP + 8) }}
              role="img"
              aria-labelledby={headingId}
            >
              {trends.map((t, i) => {
                const h = Math.round((t.sales_paisa / axisMax) * (H - TOP_PAD));
                const isPeak = i === peakIndex && t.sales_paisa > 0;
                const isHot = hovered === i;
                return (
                  <div
                    key={t.date}
                    onPointerEnter={() => setHovered(i)}
                    onPointerLeave={() => setHovered((h2) => (h2 === i ? null : h2))}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered((h2) => (h2 === i ? null : h2))}
                    tabIndex={0}
                    /* The hit target is the whole column, not the painted bar. */
                    className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-default outline-hidden"
                    style={{ maxWidth: COL_MAX_W, minWidth: 8 }}
                  >
                    {/* Selective label: the peak only, never every column. */}
                    {isPeak && (
                      <span className="absolute font-mono text-[9.5px] font-bold text-jungle-teal-800 whitespace-nowrap"
                            style={{ bottom: h + 3 }}>
                        {formatTaka(t.sales_paisa).compact}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t transition-colors"
                      style={{
                        height: Math.max(h, t.sales_paisa > 0 ? 3 : 1),
                        maxWidth: BAR_MAX_W,
                        margin: '0 auto',
                        // muted-teal: this palette's ramp for money taken.
                        background: t.sales_paisa === 0 ? '#c4d4cd' : isHot ? '#283e32' : '#517b64',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/*
              X axis. Past a dozen columns there is no room for "Sep 12" under
              each, so only every Nth is named - and by its day number, since
              splitting the short date took the month and labelled a whole month
              of columns "Sep".
            */}
            <div className="flex mt-1.5 justify-center" style={{ gap: BAR_GAP, minWidth: trends.length * (BAR_GAP + 8) }}>
              {trends.map((t, i) => {
                const stride = Math.ceil(trends.length / 12);
                const dense = trends.length > 12;
                const show = !dense || i % stride === 0 || i === trends.length - 1;
                return (
                  <span
                    key={t.date}
                    className={`flex-1 text-center font-mono text-[9px] truncate ${
                      hovered === i ? 'text-jungle-teal-900 font-bold' : 'text-jungle-teal-500'
                    }`}
                    style={{ maxWidth: COL_MAX_W, minWidth: 8 }}
                  >
                    {!show ? '' : dense ? new Date(t.date).getDate() : dayLabel(t.date)}
                  </span>
                );
              })}
            </div>
          </div>

          {/*
            Readout rather than a floating tooltip: the chart sits in a scrolling
            card, and an absolutely positioned bubble above a column is clipped by
            the card the moment it reaches the top row - the same trap the Reports
            chart fell into. Held here, it cannot be cropped and it holds still
            long enough to read.
          */}
          <div className="mt-2 h-6 flex items-center">
            {active ? (
              <span className="inline-flex items-center gap-2 text-ui-xs font-mono bg-jungle-teal-100 border border-jungle-teal-300 rounded-lg px-2.5 py-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#517b64' }} />
                <span className="font-bold text-jungle-teal-900">{formatTaka(active.sales_paisa).full}</span>
                <span className="text-jungle-teal-400">·</span>
                <span className="text-jungle-teal-700">{dayLabel(active.date, true)}</span>
                <span className="text-jungle-teal-400">·</span>
                <span className="text-jungle-teal-700">
                  {active.orders_count} {active.orders_count === 1 ? 'invoice' : 'invoices'}
                </span>
              </span>
            ) : (
              <span className="text-ui-2xs text-jungle-teal-500 font-sans">Hover a column for that day’s figures.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
