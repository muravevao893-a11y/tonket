import { useEffect, useMemo, useState } from 'react';
import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { api } from './api.js';

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  tg?.ready?.();
  const user = tg?.initDataUnsafe?.user;
  return {
    telegramId: user?.id ? String(user.id) : 'local_demo_777',
    username: user?.username || 'local_degen',
    firstName: user?.first_name || 'Local',
    lastName: user?.last_name || 'Degen'
  };
}

const demoNames = [
  ['Degen Hamster', 'HAM', 'Хомяк, который видел свечи и выжил. Почти.'],
  ['BlinCoin', 'BLIN', 'Кривая растет, блины жарятся, ликвидность не грустит.'],
  ['Telegram Frog', 'TFROG', 'Мемный Jetton для людей, которые нажали купить быстрее, чем подумали.']
];

export default function App() {
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const telegramUser = useMemo(getTelegramUser, []);

  const [tokens, setTokens] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    name: 'Degen Hamster',
    ticker: 'HAM',
    description: 'Хомяк, который видел свечи и выжил. Почти.',
    targetLiquidityTon: '100',
    basePriceTon: '0.01',
    slopeTon: '0.0000005'
  });

  async function loadTokens(nextSelectedId) {
    const data = await api.listTokens();
    setTokens(data.tokens);
    const preferredId = nextSelectedId || selectedId || data.tokens[0]?.id || null;
    setSelectedId(preferredId);
    if (preferredId) {
      const detail = await api.getToken(preferredId);
      setSelected(detail);
    } else {
      setSelected(null);
    }
  }

  async function refreshSelected(id = selectedId) {
    if (!id) return;
    const detail = await api.getToken(id);
    setSelected(detail);
    const list = await api.listTokens();
    setTokens(list.tokens);
  }

  useEffect(() => {
    loadTokens().catch((error) => setNotice(error.message));
    api.health().catch(() => setNotice('API пока не отвечает. Запусти backend, не заставляй хомяка страдать.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    refreshSelected(selectedId).catch((error) => setNotice(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !amount) return;
    const timer = setTimeout(() => {
      api.quote(selectedId, side, amount)
        .then((data) => setQuote(data.quote))
        .catch((error) => setQuote({ error: error.message }));
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedId, side, amount, selected?.token?.currentSupplyAtomic]);

  function randomizeToken() {
    const pick = demoNames[Math.floor(Math.random() * demoNames.length)];
    setForm((current) => ({
      ...current,
      name: pick[0],
      ticker: pick[1],
      description: pick[2]
    }));
  }

  async function createToken(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const data = await api.createToken({ ...form, telegramId: telegramUser.telegramId });
      setNotice(`Токен ${data.token.ticker} создан. Хомяк нажал большую зеленую кнопку.`);
      await loadTokens(data.token.id);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function executeTrade() {
    if (!selectedId) return;
    setBusy(true);
    setNotice('');
    try {
      const prepared = await api.prepareTrade(selectedId, { side, amount });

      if (walletAddress && side === 'buy') {
        await tonConnectUI.sendTransaction(prepared.tonConnectTransaction);
      }

      const txHash = `${walletAddress ? 'wallet' : 'local'}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const result = await api.confirmTrade(selectedId, {
        telegramId: telegramUser.telegramId,
        side,
        amount,
        walletAddress: walletAddress || 'local_demo_wallet',
        tonTxHash: txHash
      });

      const graduatedText = result.graduationEvent
        ? ' Target достигнут, торги заблокированы, создан draft события для STON.fi.'
        : '';
      setNotice(`${side === 'buy' ? 'Покупка' : 'Продажа'} подтверждена локально.${graduatedText}`);
      await refreshSelected(selectedId);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  const token = selected?.token;
  const trades = selected?.trades || [];

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="badge">TON + Jetton + Bonding Curve</div>
          <h1>TONKET</h1>
          <p>
            Мини-лаунчпад для мемных Jetton-токенов: создаешь монету, торгуешь по кривой,
            доходишь до target liquidity — и готовишь graduation на DEX.
          </p>
          <div className="hero-actions">
            <a href="#create" className="primary-link">Создать токен</a>
            <a href="#trade" className="ghost-link">Открыть рынок</a>
          </div>
        </div>
        <div className="wallet-card">
          <span>Wallet</span>
          <TonConnectButton />
          <small>{walletAddress || 'Можно тестить локально без кошелька'}</small>
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="grid two">
        <form id="create" className="card" onSubmit={createToken}>
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Factory</p>
              <h2>Создать Jetton</h2>
            </div>
            <button type="button" className="tiny-button" onClick={randomizeToken}>рандом мем</button>
          </div>

          <label>
            Название
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Тикер
            <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
          </label>
          <label>
            Описание
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="mini-grid">
            <label>
              Target TON
              <input value={form.targetLiquidityTon} onChange={(e) => setForm({ ...form, targetLiquidityTon: e.target.value })} />
            </label>
            <label>
              Base price
              <input value={form.basePriceTon} onChange={(e) => setForm({ ...form, basePriceTon: e.target.value })} />
            </label>
            <label>
              Slope
              <input value={form.slopeTon} onChange={(e) => setForm({ ...form, slopeTon: e.target.value })} />
            </label>
          </div>
          <button disabled={busy} className="primary-button">Создать</button>
        </form>

        <section className="card">
          <p className="eyebrow">Live tokens</p>
          <h2>Рынок</h2>
          <div className="token-list">
            {tokens.length === 0 && <p className="muted">Пока пусто. Создай первого хомяка.</p>}
            {tokens.map((item) => (
              <button
                key={item.id}
                className={`token-row ${item.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span>
                  <b>{item.ticker}</b>
                  <small>{item.name}</small>
                </span>
                <span className="right">
                  <b>{item.currentPriceTon} TON</b>
                  <small>{item.progressPercent.toFixed(2)}%</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <section id="trade" className="grid market-grid">
        <section className="card market-card">
          <p className="eyebrow">Bonding Curve</p>
          <h2>{token ? `${token.name} / ${token.ticker}` : 'Выбери токен'}</h2>

          {token && (
            <>
              <div className="stats">
                <div><span>Цена</span><b>{token.currentPriceTon} TON</b></div>
                <div><span>Supply</span><b>{token.currentSupply}</b></div>
                <div><span>Raised</span><b>{token.raisedTon} / {token.targetLiquidityTon} TON</b></div>
                <div><span>Status</span><b>{token.status}</b></div>
              </div>
              <div className="progress">
                <div style={{ width: `${Math.min(100, token.progressPercent)}%` }} />
              </div>
              <p className="description">{token.description}</p>
            </>
          )}
        </section>

        <section className="card trade-card">
          <p className="eyebrow">Trade</p>
          <div className="tabs">
            <button className={side === 'buy' ? 'selected' : ''} onClick={() => setSide('buy')}>Buy</button>
            <button className={side === 'sell' ? 'selected' : ''} onClick={() => setSide('sell')}>Sell</button>
          </div>
          <label>
            Amount tokens
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <div className="quote-box">
            {quote?.error && <p className="danger">{quote.error}</p>}
            {!quote?.error && quote && (
              <>
                <div><span>Gross</span><b>{quote.grossTon} TON</b></div>
                <div><span>Fee 1%</span><b>{quote.feeTon} TON</b></div>
                <div><span>{side === 'buy' ? 'Wallet pays' : 'Wallet receives'}</span><b>{side === 'buy' ? quote.totalTon : quote.netTon} TON</b></div>
                <div><span>End price</span><b>{quote.priceEndTon} TON</b></div>
              </>
            )}
          </div>

          <button disabled={busy || !token || token.status !== 'funding'} onClick={executeTrade} className="primary-button wide">
            {busy ? 'Думаем...' : walletAddress && side === 'buy' ? 'Send TonConnect tx' : 'Simulate trade'}
          </button>
          <small className="muted">
            В MVP sell и confirm работают локально. В production подтверждение должно идти только через on-chain verifier.
          </small>
        </section>
      </section>

      <section className="card">
        <p className="eyebrow">Recent trades</p>
        <h2>История</h2>
        <div className="trade-list">
          {trades.length === 0 && <p className="muted">Сделок пока нет.</p>}
          {trades.map((trade) => (
            <div className="trade-row" key={trade.ton_tx_hash || trade.created_at}>
              <span className={trade.side}>{trade.side.toUpperCase()}</span>
              <b>{trade.tokenAmount} tokens</b>
              <small>{trade.netTon} TON net • fee {trade.feeTon}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
