import { useState } from 'react';
import type { TokenItem } from '../types/app';
import { useTokenCandles } from '../hooks/useTokenCandles';
import LiveCandleChart, { type CandleInterval } from './LiveCandleChart';
import { Button, cn, shortAddress, StatPill } from './ui';

type TradeSide = 'buy' | 'sell';

export function TokenDetailSheet({
  token,
  walletAddress,
  busy,
  onClose,
  onTrade,
}: {
  token: TokenItem | null;
  walletAddress: string;
  busy: boolean;
  onClose: () => void;
  onTrade: (token: TokenItem, side: TradeSide, amount: string) => Promise<void>;
}) {
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('100');
  const candles = useTokenCandles(token?.id || null, interval, 3000);

  if (!token) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm lg:items-center lg:p-3">
      <section className="max-h-[96dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-slate-800 bg-[#0f0f13] p-4 shadow-card scrollbar-hide lg:rounded-[2rem]">
        <div className="sticky -top-4 z-10 -mx-4 border-b border-white/5 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-black text-white">${token.ticker}</h2>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-300">{token.status}</span>
              </div>
              <p className="truncate text-sm font-bold text-slate-500">{token.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 px-3 py-2 text-sm font-black text-slate-300 transition-all duration-300 hover:bg-slate-800 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatPill label="Price" value={`${token.currentPriceTon} TON`} />
          <StatPill label="MCap" value={token.marketCap} />
          <StatPill label="DEX" value={`${token.progressPercent.toFixed(1)}%`} />
        </div>

        <div className="mt-4">
          <LiveCandleChart
            historicalData={candles.historicalData}
            liveTick={candles.liveTick}
            interval={interval}
            onIntervalChange={setInterval}
            isLoading={candles.loading}
            emptyLabel={`No candles for $${token.ticker} yet`}
          />
          {candles.error && <p className="mt-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">{candles.error}</p>}
        </div>

        <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex rounded-2xl bg-slate-900 p-1">
            {(['buy', 'sell'] as TradeSide[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSide(item)}
                className={cn(
                  'flex-1 rounded-xl px-4 py-2 text-sm font-black transition-all duration-300 active:scale-95',
                  side === item ? (item === 'buy' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200',
                )}
              >
                {item === 'buy' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Token amount</label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-xl font-black text-white outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20"
            placeholder="100"
          />

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {['10', '100', '1000', '10000'].map((value) => (
              <button key={value} type="button" onClick={() => setAmount(value)} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-400 transition-all duration-300 hover:bg-slate-800 active:scale-95">
                {value}
              </button>
            ))}
          </div>

          <Button
            disabled={busy || !walletAddress || token.status !== 'funding'}
            onClick={() => onTrade(token, side, amount)}
            className={cn('mt-4 w-full text-white shadow-glow', side === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500')}
          >
            {busy ? 'Preparing TonConnect…' : `${side === 'buy' ? 'Buy' : 'Sell'} via TonConnect`}
          </Button>

          <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-xs font-semibold text-slate-500">
            Wallet: <span className="font-black text-slate-300">{walletAddress ? shortAddress(walletAddress) : 'Connect wallet first'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
