import { useCallback, useEffect, useState } from 'react';
import { fetchCandles, fetchLiveTick } from '../lib/api';
import type { CandleInterval, LiveCandleData, LiveTick } from '../components/LiveCandleChart';

export function useTokenCandles(tokenId: string | null, interval: CandleInterval, refreshMs = 3000) {
  const [historicalData, setHistoricalData] = useState<LiveCandleData[]>([]);
  const [liveTick, setLiveTick] = useState<LiveTick>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tokenId) {
      setHistoricalData([]);
      setLiveTick(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchCandles(tokenId, interval, 350);
      setHistoricalData(response.candles);
      const tickResponse = await fetchLiveTick(tokenId);
      setLiveTick(tickResponse.tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candles');
    } finally {
      setLoading(false);
    }
  }, [interval, tokenId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!tokenId || refreshMs <= 0) return;
    let cancelled = false;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetchLiveTick(tokenId);
        if (!cancelled) setLiveTick(response.tick);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Live tick failed');
      }
    }, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMs, tokenId]);

  return { historicalData, liveTick, loading, error, reload };
}
