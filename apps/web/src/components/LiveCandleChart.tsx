import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { cn } from './ui';

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type LiveCandleData = {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LiveTick = {
  time: number | string;
  price: number;
} | null;

type HoveredCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LiveCandleChartProps = {
  historicalData: LiveCandleData[];
  liveTick: LiveTick;
  interval?: CandleInterval;
  onIntervalChange?: (interval: CandleInterval) => void;
  height?: number;
  isLoading?: boolean;
  className?: string;
  emptyLabel?: string;
};

const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14_400,
  '1d': 86_400,
};

const INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

function toUnixSeconds(time: number | string): UTCTimestamp {
  if (typeof time === 'number') {
    const seconds = time > 1_000_000_000_000 ? Math.floor(time / 1000) : Math.floor(time);
    return seconds as UTCTimestamp;
  }

  const numeric = Number(time);
  if (Number.isFinite(numeric)) {
    return toUnixSeconds(numeric);
  }

  const parsed = Date.parse(time);
  if (!Number.isFinite(parsed)) {
    return Math.floor(Date.now() / 1000) as UTCTimestamp;
  }

  return Math.floor(parsed / 1000) as UTCTimestamp;
}

function floorToInterval(time: UTCTimestamp, interval: CandleInterval): UTCTimestamp {
  const seconds = INTERVAL_SECONDS[interval];
  return (Math.floor(Number(time) / seconds) * seconds) as UTCTimestamp;
}

function normalizeCandle(candle: LiveCandleData): CandlestickData<UTCTimestamp> | null {
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);

  if (![open, high, low, close].every(Number.isFinite)) return null;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;

  return {
    time: toUnixSeconds(candle.time),
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
  };
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1) return value.toFixed(4);
  if (value >= 0.001) return value.toFixed(6);
  return value.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

function formatTime(time: UTCTimestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(Number(time) * 1000));
}

function LiveCandleChartComponent({
  historicalData,
  liveTick,
  interval = '1m',
  onIntervalChange,
  height = 300,
  isLoading = false,
  className,
  emptyLabel = 'No confirmed trades yet',
}: LiveCandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastCandleRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const lastTickKeyRef = useRef<string>('');
  const [hovered, setHovered] = useState<HoveredCandle | null>(null);
  const [hasData, setHasData] = useState(false);

  const normalizedHistoricalData = useMemo(() => {
    const byTime = new Map<number, CandlestickData<UTCTimestamp>>();
    for (const rawCandle of historicalData || []) {
      const candle = normalizeCandle(rawCandle);
      if (candle) byTime.set(Number(candle.time), candle);
    }

    return [...byTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
  }, [historicalData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth || 1,
      height,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.5)',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.16)',
          labelBackgroundColor: '#111827',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.16)',
          labelBackgroundColor: '#111827',
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
        fixLeftEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.14 },
      },
      leftPriceScale: { visible: false },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      localization: {
        priceFormatter: formatPrice,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: true,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const series = candleSeriesRef.current;
      if (!series || !param.time) {
        setHovered(null);
        return;
      }

      const candle = param.seriesData.get(series) as CandlestickData<UTCTimestamp> | undefined;
      if (!candle || typeof candle.open !== 'number') {
        setHovered(null);
        return;
      }

      setHovered({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lastCandleRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    series.setData(normalizedHistoricalData);
    const lastCandle = normalizedHistoricalData[normalizedHistoricalData.length - 1] || null;
    lastCandleRef.current = lastCandle;
    setHasData(normalizedHistoricalData.length > 0);

    if (normalizedHistoricalData.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [normalizedHistoricalData]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !liveTick) return;

    const tickTime = toUnixSeconds(liveTick.time);
    const tickPrice = Number(liveTick.price);
    if (!Number.isFinite(tickPrice) || tickPrice <= 0) return;

    const tickKey = `${tickTime}:${tickPrice}`;
    if (lastTickKeyRef.current === tickKey) return;
    lastTickKeyRef.current = tickKey;

    const bucketTime = floorToInterval(tickTime, interval);
    const previous = lastCandleRef.current;

    let nextCandle: CandlestickData<UTCTimestamp>;
    if (!previous) {
      nextCandle = {
        time: bucketTime,
        open: tickPrice,
        high: tickPrice,
        low: tickPrice,
        close: tickPrice,
      };
    } else if (Number(bucketTime) <= Number(previous.time)) {
      nextCandle = {
        time: previous.time,
        open: previous.open,
        high: Math.max(previous.high, tickPrice),
        low: Math.min(previous.low, tickPrice),
        close: tickPrice,
      };
    } else {
      nextCandle = {
        time: bucketTime,
        open: previous.close,
        high: Math.max(previous.close, tickPrice),
        low: Math.min(previous.close, tickPrice),
        close: tickPrice,
      };
    }

    series.update(nextCandle);
    lastCandleRef.current = nextCandle;
    setHasData(true);
  }, [interval, liveTick]);

  const lastCandle = hovered || lastCandleRef.current;
  const isUp = lastCandle ? lastCandle.close >= lastCandle.open : true;

  const fitContent = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  return (
    <div className={cn('rounded-3xl border border-slate-800 bg-slate-950/40 p-3', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', isUp ? 'bg-emerald-400 shadow-[0_0_14px_rgba(34,197,94,0.65)]' : 'bg-red-400 shadow-[0_0_14px_rgba(239,68,68,0.65)]')} />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Live chart</p>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl font-black text-white">{lastCandle ? `${formatPrice(lastCandle.close)} TON` : '—'}</span>
            {lastCandle && <span className="text-xs font-bold text-slate-500">{formatTime(lastCandle.time as UTCTimestamp)}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={fitContent}
          className="rounded-full border border-white/5 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 transition-all duration-300 hover:bg-slate-800 active:scale-95"
        >
          Fit
        </button>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {INTERVALS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onIntervalChange?.(item)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-black transition-all duration-300 active:scale-95',
              interval === item ? 'bg-blue-600 text-white shadow-glow' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-transparent" style={{ height }}>
        <div ref={containerRef} className="h-full w-full bg-transparent" />

        {!isLoading && !hasData && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/25 text-center backdrop-blur-[1px]">
            <div>
              <div className="text-3xl">📉</div>
              <p className="mt-2 text-sm font-black text-white">{emptyLabel}</p>
              <p className="mt-1 text-xs text-slate-500">First confirmed buy/sell will create the first candle.</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/45 backdrop-blur-sm">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-slate-300">Loading candles…</div>
          </div>
        )}
      </div>

      {lastCandle && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-slate-900/70 p-2"><p className="text-[10px] font-bold text-slate-500">O</p><p className="truncate text-xs font-black text-white">{formatPrice(lastCandle.open)}</p></div>
          <div className="rounded-2xl bg-slate-900/70 p-2"><p className="text-[10px] font-bold text-slate-500">H</p><p className="truncate text-xs font-black text-emerald-300">{formatPrice(lastCandle.high)}</p></div>
          <div className="rounded-2xl bg-slate-900/70 p-2"><p className="text-[10px] font-bold text-slate-500">L</p><p className="truncate text-xs font-black text-red-300">{formatPrice(lastCandle.low)}</p></div>
          <div className="rounded-2xl bg-slate-900/70 p-2"><p className="text-[10px] font-bold text-slate-500">C</p><p className="truncate text-xs font-black text-white">{formatPrice(lastCandle.close)}</p></div>
        </div>
      )}

      <p className="mt-3 text-[10px] font-semibold text-slate-600">Charts by TradingView Lightweight Charts™</p>
    </div>
  );
}

export const LiveCandleChart = memo(LiveCandleChartComponent);
export default LiveCandleChart;
