import type { ApiError, BootstrapPayload, CandleInterval, CandlePoint, LiveTickPoint, TokenItem, WalletProfile } from '../types/app';

const TOKEN_KEY = 'tonket.sessionToken';
const REQUEST_TIMEOUT_MS = 15_000;

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function looksLikeHtml(value: string) {
  return value.trim().startsWith('<!doctype') || value.trim().startsWith('<html') || value.includes('<div id="root"');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API timeout: ${path}`);
    }
    throw new Error(`API network error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    window.clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text().catch(() => '');

  if (!contentType.includes('application/json')) {
    if (looksLikeHtml(text)) {
      throw new Error(`API returned frontend HTML instead of JSON for ${path}. Check Railway routing/build output.`);
    }
    throw new Error(`API returned non-JSON response for ${path}: HTTP ${response.status}`);
  }

  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const apiError = json as ApiError;
    throw new Error(apiError.error || `Request failed: ${response.status}`);
  }
  return json as T;
}

export async function authTelegram(initData: string) {
  const payload = await request<{ sessionToken: string; expiresAt: string; me: BootstrapPayload['me'] }>('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
  setSessionToken(payload.sessionToken);
  return payload;
}

export function fetchHealth() {
  return request<Record<string, unknown>>('/health');
}

export function fetchReady() {
  return request<Record<string, unknown>>('/ready');
}

export function fetchBootstrap() {
  return request<BootstrapPayload>('/api/bootstrap');
}

export function connectWallet(input: { address: string; network?: string; publicKey?: string | null; tonProof?: unknown }) {
  return request<{ wallet: WalletProfile }>('/api/wallet/connect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type CreateTokenInput = {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  telegramUrl?: string | null;
  twitterUrl?: string | null;
  targetLiquidityTon: string;
  basePriceTon: string;
  slopeTon: string;
};

export function createToken(input: CreateTokenInput) {
  return request<{ token: TokenItem; deployPlan: DeployPlan }>('/api/tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type DeployPlan =
  | { ready: false; missing: string[]; reason: string }
  | { ready: true; jettonMasterAddress: string; contentUri: string; transaction: TonConnectTransaction };

export type TonConnectTransaction = {
  validUntil: number;
  messages: Array<{
    address: string;
    amount: string;
    payload?: string;
    stateInit?: string;
  }>;
};

export function confirmDeploy(tokenId: string, txHash: string) {
  return request<{ token: TokenItem; status: string }>(`/api/tokens/${tokenId}/deploy/confirm`, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });
}

export function activateToken(tokenId: string) {
  return request<{ token: TokenItem }>(`/api/tokens/${tokenId}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function prepareTrade(input: { tokenId: string; side: 'buy' | 'sell'; amount: string; walletAddress: string }) {
  return request<{ tradeId: string; quote: Record<string, string>; transaction: TonConnectTransaction }>(
    `/api/tokens/${input.tokenId}/trades/prepare`,
    {
      method: 'POST',
      body: JSON.stringify({ side: input.side, amount: input.amount, walletAddress: input.walletAddress }),
    },
  );
}

export function confirmTrade(tradeId: string, txHash: string) {
  return request<{ token: TokenItem; graduation: unknown }>(`/api/trades/${tradeId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });
}

export function fetchCandles(tokenId: string, interval: CandleInterval = '1m', limit = 250) {
  const params = new URLSearchParams({ interval, limit: String(limit) });
  return request<{ interval: CandleInterval; limit: number; candles: CandlePoint[] }>(`/api/tokens/${tokenId}/candles?${params.toString()}`);
}

export function fetchLiveTick(tokenId: string) {
  return request<{ tick: LiveTickPoint }>(`/api/tokens/${tokenId}/tick`);
}
