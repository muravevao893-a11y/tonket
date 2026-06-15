import type { ApiError, BootstrapPayload, TokenItem, WalletProfile } from '../types/app';

const TOKEN_KEY = 'tonket.sessionToken';

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });
  const json = await response.json().catch(() => ({}));
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
