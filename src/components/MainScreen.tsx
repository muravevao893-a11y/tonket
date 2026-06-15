import { useMemo, useState } from 'react';
import { tokens, type Token } from '../data/tokens';

type TabKey = 'home' | 'launch' | 'search' | 'profile';
type SortKey = 'hot' | 'new' | 'graduating';

const sortLabels: Record<SortKey, string> = {
  hot: 'Hot',
  new: 'New',
  graduating: 'Graduating',
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatPrice(price: number) {
  return `${price.toFixed(price < 0.001 ? 5 : 4)} TON`;
}

function TonLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="28" cy="28" r="28" fill="#0098EA" />
      <path
        d="M17.7 19.4C18.2 18.5 19.1 18 20.1 18H35.9C36.9 18 37.8 18.5 38.3 19.4C38.8 20.3 38.7 21.3 38.1 22.1L29.9 36.4C29.5 37.1 28.8 37.5 28 37.5C27.2 37.5 26.5 37.1 26.1 36.4L17.9 22.1C17.3 21.3 17.2 20.3 17.7 19.4Z"
        fill="white"
      />
      <path d="M20.4 21.1H26.5V31.5L20.4 21.1ZM29.5 21.1H35.6L29.5 31.5V21.1Z" fill="#0098EA" />
    </svg>
  );
}

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 10.8L12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z"
        stroke={active ? '#0098EA' : 'currentColor'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RocketIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M14.5 4.5C17.2 3.5 20 4 20 4s.5 2.8-.5 5.5c-.9 2.5-3 5-6.6 7.2L8 11.8c2.2-3.6 4.7-5.7 6.5-7.3Z"
        stroke={active ? '#0098EA' : 'currentColor'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 12.2L5.5 12 4 13.5l3.2 1.2M11.8 15.8l.2 2.7L10.5 20l-1.2-3.2M15 9h.01"
        stroke={active ? '#0098EA' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6ZM16.2 16.2 21 21"
        stroke={active ? '#0098EA' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0"
        stroke={active ? '#0098EA' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function SegmentButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ease-in-out active:scale-95',
        active
          ? 'bg-blue-600 text-white shadow-glow'
          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-100',
      )}
    >
      {children}
    </button>
  );
}

function TokenCard({ token }: { token: Token }) {
  const isPositive = token.change24h >= 0;

  return (
    <article
      role="button"
      tabIndex={0}
      className="group cursor-pointer rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-card outline-none transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800/90 focus-visible:ring-2 focus-visible:ring-blue-500/70 active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950 text-3xl shadow-inner">
          <span aria-hidden="true">{token.avatar}</span>
          {token.isHot && (
            <span className="absolute -right-1 -top-1 rounded-full border border-slate-900 bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">
              🔥
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black tracking-tight text-white">{token.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span>${token.ticker}</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>{token.creator}</span>
              </div>
            </div>

            <div
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-black',
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400',
              )}
            >
              {isPositive ? '+' : ''}
              {token.change24h}%
            </div>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{token.description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatPill label="Price" value={formatPrice(token.priceTon)} />
        <StatPill label="MCap" value={token.marketCap} />
        <StatPill label="Holders" value={Intl.NumberFormat('en', { notation: 'compact' }).format(token.holders)} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-400">Bonding curve</span>
          <span className="font-black text-blue-400">{token.progress}% to DEX</span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-in-out"
            style={{ width: `${token.progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>💬 {token.replies}</span>
            <span>💧 {token.liquidity}</span>
          </div>

          <button
            type="button"
            className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-glow transition-all duration-300 ease-in-out hover:bg-blue-500 active:scale-95"
          >
            Buy
          </button>
        </div>
      </div>
    </article>
  );
}

function BottomTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all duration-300 ease-in-out active:scale-95',
        active ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function MainScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [sort, setSort] = useState<SortKey>('hot');

  const sortedTokens = useMemo(() => {
    const list = [...tokens];

    if (sort === 'new') {
      return list.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || Number(b.id) - Number(a.id));
    }

    if (sort === 'graduating') {
      return list.sort((a, b) => b.progress - a.progress);
    }

    return list.sort((a, b) => Number(Boolean(b.isHot)) - Number(Boolean(a.isHot)) || b.change24h - a.change24h);
  }, [sort]);

  const totalLiquidity = useMemo(() => {
    const total = tokens.reduce((sum, token) => {
      const numeric = Number.parseFloat(token.liquidity.replace('K TON', ''));
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);

    return `${total.toFixed(1)}K TON`;
  }, []);

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#0f0f13] text-slate-100">
      <div className="relative mx-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(0,152,234,0.16),_transparent_34%),linear-gradient(180deg,#0f0f13_0%,#020617_100%)] lg:max-w-md lg:border-x lg:border-gray-800">
        <header className="safe-top sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 px-4 pb-3 pt-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-2xl px-1 py-1 text-left transition-all duration-300 ease-in-out hover:bg-slate-900 active:scale-95"
              aria-label="Open TONKET home"
            >
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 shadow-glow">
                <TonLogo className="h-7 w-7" />
              </div>
              <div>
                <div className="text-base font-black leading-5 tracking-tight text-white">TONKET</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-400">meme launchpad</div>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white transition-all duration-300 ease-in-out hover:bg-slate-800 active:scale-95"
                aria-label="Wallet balance"
              >
                <TonLogo className="h-4 w-4" />
                12.84
              </button>

              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-slate-900 text-lg transition-all duration-300 ease-in-out hover:bg-slate-800 active:scale-95"
                aria-label="Open profile"
              >
                👤
              </button>
            </div>
          </div>
        </header>

        <section className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-24 pt-4">
          <div className="rounded-[2rem] border border-blue-500/20 bg-blue-600/10 p-4 shadow-glow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-300">
                  🚀 live curves
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Launch memes before they learn accounting</h1>
                <p className="mt-2 text-sm leading-5 text-slate-300">
                  Create, buy and graduate TON memes from bonding curve to public DEX liquidity.
                </p>
              </div>

              <div className="hidden shrink-0 rounded-3xl border border-white/10 bg-slate-950/60 p-3 text-4xl sm:block">💎</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatPill label="Tokens" value="5.2K" />
              <StatPill label="Volume" value={totalLiquidity} />
              <StatPill label="Fee" value="1%" />
            </div>

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-glow transition-all duration-300 ease-in-out hover:bg-blue-500 active:scale-95"
            >
              <PlusIcon />
              Create token
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">Trending tokens</h2>
              <p className="text-sm text-slate-500">Fresh curves, loud communities.</p>
            </div>

            <button
              type="button"
              className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300 transition-all duration-300 ease-in-out hover:bg-slate-800 active:scale-95"
            >
              View all
            </button>
          </div>

          <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <SegmentButton key={key} active={sort === key} onClick={() => setSort(key)}>
                {sortLabels[key]}
              </SegmentButton>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            {sortedTokens.map((token) => (
              <TokenCard key={token.id} token={token} />
            ))}
          </div>
        </section>

        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 mx-auto border-t border-white/5 bg-slate-950/80 px-3 pb-3 pt-2 backdrop-blur-md lg:max-w-md lg:border-x lg:border-gray-800">
          <div className="flex gap-1 rounded-[1.75rem] border border-white/5 bg-slate-950/60 p-1.5">
            <BottomTab label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon active={activeTab === 'home'} />} />
            <BottomTab label="Launch" active={activeTab === 'launch'} onClick={() => setActiveTab('launch')} icon={<RocketIcon active={activeTab === 'launch'} />} />
            <BottomTab label="Search" active={activeTab === 'search'} onClick={() => setActiveTab('search')} icon={<SearchIcon active={activeTab === 'search'} />} />
            <BottomTab label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<ProfileIcon active={activeTab === 'profile'} />} />
          </div>
        </nav>
      </div>
    </main>
  );
}
