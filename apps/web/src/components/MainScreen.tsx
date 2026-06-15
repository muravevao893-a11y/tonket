import { useEffect, useMemo, useState } from 'react';
import { TonConnectButton, useTonAddress, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import type { BootstrapPayload, TokenItem } from '../types/app';
import { activateToken, authTelegram, clearSessionToken, confirmDeploy, confirmTrade, connectWallet, createToken, fetchBootstrap, getSessionToken, prepareTrade, type CreateTokenInput } from '../lib/api';
import { HomeIcon, PlusIcon, ProfileIcon, RocketIcon, SearchIcon, TonLogo } from './icons';
import { Button, cn, haptic, shortAddress, StatPill, StatusBadge } from './ui';

type TabKey = 'home' | 'launch' | 'search' | 'profile';
type SortKey = 'hot' | 'new' | 'graduating';

type Toast = { type: 'success' | 'error' | 'info'; text: string } | null;

const emptyForm: CreateTokenInput = {
  name: '',
  ticker: '',
  description: '',
  imageUrl: '',
  websiteUrl: '',
  telegramUrl: '',
  twitterUrl: '',
  targetLiquidityTon: '100',
  basePriceTon: '0.001',
  slopeTon: '0.000001',
};

function avatarFallback(token: TokenItem) {
  const icons = ['🚀', '🔥', '💎', '🐳', '👾', '🦴', '🧠', '⚡'];
  let sum = 0;
  for (const char of token.ticker) sum += char.charCodeAt(0);
  return icons[sum % icons.length];
}

function BottomTab({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        onClick();
      }}
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

function TokenCard({ token, onBuy }: { token: TokenItem; onBuy: (token: TokenItem) => void }) {
  return (
    <article className="group rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-card transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800/90 active:scale-[0.98]">
      <div className="flex items-start gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-3xl shadow-inner">
          {token.imageUrl ? <img src={token.imageUrl} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{avatarFallback(token)}</span>}
          {token.progressPercent >= 80 && <span className="absolute -right-1 -top-1 rounded-full border border-slate-900 bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">🔥</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black tracking-tight text-white">{token.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span>${token.ticker}</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>{token.holders} holders</span>
              </div>
            </div>
            <StatusBadge status={token.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-400">{token.description || 'No lore yet. Suspicious, but we respect the grind.'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatPill label="Price" value={`${token.currentPriceTon} TON`} />
        <StatPill label="MCap" value={token.marketCap} />
        <StatPill label="Supply" value={token.currentSupply} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-400">Bonding curve</span>
          <span className="font-black text-blue-400">{token.progressPercent.toFixed(1)}% to DEX</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-in-out" style={{ width: `${token.progressPercent}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-slate-500">
            <span>💧 {token.raisedTon}/{token.targetLiquidityTon} TON</span>
          </div>
          <Button
            type="button"
            disabled={token.status !== 'funding'}
            onClick={() => onBuy(token)}
            className="bg-blue-600 px-4 py-2 text-xs text-white shadow-glow hover:bg-blue-500"
          >
            Buy
          </Button>
        </div>
      </div>
    </article>
  );
}

function CreateTokenPanel({ busy, onCreate }: { busy: boolean; onCreate: (input: CreateTokenInput) => Promise<void> }) {
  const [form, setForm] = useState<CreateTokenInput>(emptyForm);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onCreate(form);
    setForm(emptyForm);
  }

  const inputClass = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20';

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-xl shadow-glow">🚀</div>
        <div>
          <h2 className="text-lg font-black text-white">Launch token</h2>
          <p className="text-xs text-slate-500">Backend stores it, wallet signs deploy. Без демо-счетов, всё по-взрослому.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Token name" required minLength={2} maxLength={80} />
        <input className={inputClass} value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })} placeholder="Ticker, e.g. TONK" required minLength={2} maxLength={12} />
        <textarea className={cn(inputClass, 'min-h-24 resize-none')} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Meme lore / description" maxLength={2000} />
        <input className={inputClass} value={form.imageUrl || ''} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Image URL, optional" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input className={inputClass} value={form.targetLiquidityTon} onChange={(event) => setForm({ ...form, targetLiquidityTon: event.target.value })} placeholder="Target TON" />
          <input className={inputClass} value={form.basePriceTon} onChange={(event) => setForm({ ...form, basePriceTon: event.target.value })} placeholder="Base price" />
          <input className={inputClass} value={form.slopeTon} onChange={(event) => setForm({ ...form, slopeTon: event.target.value })} placeholder="Slope" />
        </div>
      </div>

      <Button disabled={busy} className="mt-4 w-full bg-blue-600 text-white shadow-glow hover:bg-blue-500">
        {busy ? 'Creating…' : 'Create & prepare Jetton deploy'}
      </Button>
    </form>
  );
}

function BuySheet({ token, walletAddress, busy, onClose, onBuy }: { token: TokenItem | null; walletAddress: string; busy: boolean; onClose: () => void; onBuy: (token: TokenItem, amount: string) => Promise<void> }) {
  const [amount, setAmount] = useState('100');
  if (!token) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm lg:items-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">Buy ${token.ticker}</h3>
            <p className="text-sm text-slate-500">Wallet: {shortAddress(walletAddress)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-900 px-3 py-2 text-sm font-black text-slate-300 transition-all hover:bg-slate-800 active:scale-95">✕</button>
        </div>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-xl font-black text-white outline-none focus:border-blue-500/70" />
        <Button disabled={busy || !walletAddress} onClick={() => onBuy(token, amount)} className="mt-4 w-full bg-blue-600 text-white shadow-glow hover:bg-blue-500">
          {busy ? 'Sending transaction…' : 'Send TonConnect transaction'}
        </Button>
        {!walletAddress && <p className="mt-3 text-center text-xs text-amber-300">Connect TON wallet first.</p>}
      </div>
    </div>
  );
}

export default function MainScreen() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const tonAddress = useTonAddress();
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [sort, setSort] = useState<SortKey>('hot');
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [buyToken, setBuyToken] = useState<TokenItem | null>(null);

  const tokens = data?.tokens || [];
  const tgInitData = window.Telegram?.WebApp?.initData || '';

  function showToast(type: NonNullable<Toast>['type'], text: string) {
    setToast({ type, text });
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type === 'error' ? 'error' : 'success');
    window.setTimeout(() => setToast(null), 4200);
  }

  async function load() {
    const bootstrap = await fetchBootstrap();
    setData(bootstrap);
  }

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    async function boot() {
      try {
        if (!getSessionToken()) await authTelegram(tgInitData);
        await load();
      } catch (error) {
        clearSessionToken();
        try {
          await authTelegram(tgInitData);
          await load();
        } catch (inner) {
          showToast('error', inner instanceof Error ? inner.message : 'Auth failed');
        }
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  useEffect(() => {
    async function syncWallet() {
      if (!wallet?.account?.address || !data?.me) return;
      try {
        const response = await connectWallet({
          address: wallet.account.address,
          network: wallet.account.chain ? String(wallet.account.chain) : data.config.tonNetwork,
          publicKey: wallet.account.publicKey,
        });
        setData({ ...data, me: { ...data.me, wallet: response.wallet } });
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : 'Wallet sync failed');
      }
    }
    void syncWallet();
  }, [wallet?.account?.address]);

  const sortedTokens = useMemo(() => {
    const list = [...tokens];
    if (sort === 'new') return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (sort === 'graduating') return list.sort((a, b) => b.progressPercent - a.progressPercent);
    return list.sort((a, b) => b.progressPercent - a.progressPercent || Number(b.raisedTonNano) - Number(a.raisedTonNano));
  }, [tokens, sort]);

  async function handleCreate(input: CreateTokenInput) {
    setBusy(true);
    try {
      const created = await createToken(input);
      let nextToken = created.token;

      if (created.deployPlan.ready) {
        const result = await tonConnectUI.sendTransaction(created.deployPlan.transaction);
        const txHash = JSON.stringify(result).slice(0, 240);
        const confirmed = await confirmDeploy(created.token.id, txHash);
        nextToken = confirmed.token;
        showToast('success', 'Jetton deploy transaction submitted');
      } else {
        showToast('info', `Token saved. Jetton deploy config missing: ${created.deployPlan.missing.join(', ')}`);
      }

      setData((current) => current ? { ...current, tokens: [nextToken, ...current.tokens.filter((item) => item.id !== nextToken.id)] } : current);
      setActiveTab('home');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Token creation failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate(token: TokenItem) {
    setBusy(true);
    try {
      const result = await activateToken(token.id);
      setData((current) => current ? { ...current, tokens: current.tokens.map((item) => item.id === token.id ? result.token : item) } : current);
      showToast('success', 'Token is now open for bonding curve trading');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleBuy(token: TokenItem, amount: string) {
    if (!tonAddress) {
      showToast('error', 'Connect TON wallet first');
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareTrade({ tokenId: token.id, side: 'buy', amount, walletAddress: tonAddress });
      const result = await tonConnectUI.sendTransaction(prepared.transaction);
      const txHash = JSON.stringify(result).slice(0, 240);
      const confirmed = await confirmTrade(prepared.tradeId, txHash);
      setData((current) => current ? { ...current, tokens: current.tokens.map((item) => item.id === token.id ? confirmed.token : item) } : current);
      setBuyToken(null);
      showToast('success', `Bought ${amount} ${token.ticker}`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Trade failed');
    } finally {
      setBusy(false);
    }
  }

  const me = data?.me;
  const walletAddress = tonAddress || me?.wallet?.address || '';

  return (
    <main className="h-[100dvh] overflow-y-auto scrollbar-hide bg-[#0f0f13] text-slate-100">
      <div className="min-h-[100dvh] w-full bg-[radial-gradient(circle_at_top,_rgba(0,152,234,0.18),_transparent_32%),linear-gradient(180deg,#0f172a_0%,#0f0f13_42%)] lg:mx-auto lg:max-w-md lg:border-x lg:border-gray-800">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 shadow-glow">
                <TonLogo />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-black tracking-tight text-white">TONKET</h1>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-300">Railway</span>
                </div>
                <p className="truncate text-xs font-semibold text-slate-500">{me ? `@${me.username || me.firstName || me.telegramId}` : 'Telegram Mini App'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-right sm:block">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Wallet</div>
                <div className="text-xs font-black text-white">{shortAddress(walletAddress)}</div>
              </div>
              {me?.photoUrl ? <img src={me.photoUrl} alt="" className="h-10 w-10 rounded-2xl border border-white/10 object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-slate-900 text-lg">👤</div>}
            </div>
          </div>
        </header>

        {toast && (
          <div className="fixed left-3 right-3 top-20 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm font-bold text-white shadow-card backdrop-blur-md lg:left-1/2 lg:right-auto lg:w-[26rem] lg:-translate-x-1/2">
            {toast.type === 'error' ? '⚠️ ' : toast.type === 'success' ? '✅ ' : 'ℹ️ '}{toast.text}
          </div>
        )}

        <section className="px-4 pb-28 pt-4">
          {loading && <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-sm font-bold text-slate-400">Loading real backend data…</div>}

          {!loading && !data && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
              <h2 className="text-lg font-black text-white">Telegram auth required</h2>
              <p className="mt-2 text-amber-100/80">Open this inside Telegram Mini App or enable ALLOW_DEV_AUTH=true locally. Без аккаунта Telegram я не буду рисовать тебе фейковые миллионы, у нас тут приличная шарага.</p>
            </div>
          )}

          {!loading && data && activeTab === 'home' && (
            <>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">Live curve market</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Memes with math</h2>
                    <p className="mt-1 text-sm text-slate-500">No demo balances. Every card below comes from PostgreSQL.</p>
                  </div>
                  <TonConnectButton />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <StatPill label="Tokens" value={String(data.stats.token_count || 0)} />
                  <StatPill label="Fee" value={`${data.config.platformFeeBps / 100}%`} />
                  <StatPill label="Network" value={data.config.tonNetwork} />
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
                {(['hot', 'new', 'graduating'] as SortKey[]).map((key) => (
                  <button key={key} type="button" onClick={() => setSort(key)} className={cn('rounded-full px-4 py-2 text-sm font-black transition-all duration-300 active:scale-95', sort === key ? 'bg-blue-600 text-white shadow-glow' : 'bg-slate-900 text-slate-400 hover:bg-slate-800')}>{key}</button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                {sortedTokens.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/70 p-6 text-center">
                    <div className="text-4xl">🫙</div>
                    <h3 className="mt-3 text-lg font-black text-white">No tokens yet</h3>
                    <p className="mt-1 text-sm text-slate-500">Create the first one. Да, ты можешь быть тем самым первым хомяком, исторический момент.</p>
                    <Button onClick={() => setActiveTab('launch')} className="mt-4 bg-blue-600 text-white shadow-glow hover:bg-blue-500">Launch token</Button>
                  </div>
                ) : sortedTokens.map((token) => (
                  <div key={token.id}>
                    <TokenCard token={token} onBuy={setBuyToken} />
                    {(token.status === 'deploy_submitted' || token.status === 'awaiting_deploy') && token.jettonMasterAddress && (
                      <Button disabled={busy} onClick={() => handleActivate(token)} className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-500">Activate funding for ${token.ticker}</Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && data && activeTab === 'launch' && <CreateTokenPanel busy={busy} onCreate={handleCreate} />}

          {!loading && data && activeTab === 'search' && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-card">
              <h2 className="text-xl font-black text-white">Search</h2>
              <p className="mt-2 text-sm text-slate-500">Search endpoint не мокал — пока фильтруем backend tokens локально. Следующий шаг: добавить `/api/tokens?search=` и индексы по ticker/name.</p>
              <div className="mt-4 grid gap-3">
                {tokens.slice(0, 5).map((token) => <TokenCard key={token.id} token={token} onBuy={setBuyToken} />)}
              </div>
            </div>
          )}

          {!loading && data && activeTab === 'profile' && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-card">
              <div className="flex items-center gap-4">
                {me?.photoUrl ? <img src={me.photoUrl} alt="" className="h-16 w-16 rounded-3xl border border-white/10 object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-slate-950 text-3xl">👤</div>}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-white">{me?.firstName || 'Telegram user'}</h2>
                  <p className="truncate text-sm font-bold text-slate-500">@{me?.username || me?.telegramId}</p>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border border-white/5 bg-slate-950 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Wallet</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-white">{walletAddress || 'Not connected'}</p>
                  <TonConnectButton />
                </div>
                <p className="mt-3 text-xs text-slate-500">Wallet sync writes to backend user_wallets table. Ton proof verification hook is prepared for production hardening.</p>
              </div>
              <Button onClick={() => { clearSessionToken(); location.reload(); }} className="mt-4 w-full bg-slate-800 text-slate-200 hover:bg-slate-700">Reset session</Button>
            </div>
          )}
        </section>

        <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto border-t border-white/5 bg-slate-950/80 px-3 pb-3 pt-2 backdrop-blur-md safe-bottom lg:max-w-md lg:border-x lg:border-gray-800">
          <div className="flex gap-2">
            <BottomTab label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon active={activeTab === 'home'} />} />
            <BottomTab label="Launch" active={activeTab === 'launch'} onClick={() => setActiveTab('launch')} icon={<RocketIcon active={activeTab === 'launch'} />} />
            <BottomTab label="Search" active={activeTab === 'search'} onClick={() => setActiveTab('search')} icon={<SearchIcon active={activeTab === 'search'} />} />
            <BottomTab label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<ProfileIcon active={activeTab === 'profile'} />} />
          </div>
        </nav>
      </div>

      <button type="button" onClick={() => setActiveTab('launch')} className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-glow transition-all duration-300 hover:bg-blue-500 active:scale-95 lg:left-1/2 lg:right-auto lg:ml-40">
        <PlusIcon />
      </button>

      <BuySheet token={buyToken} walletAddress={walletAddress} busy={busy} onClose={() => setBuyToken(null)} onBuy={handleBuy} />
    </main>
  );
}
