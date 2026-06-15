export type UserProfile = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  photoUrl: string | null;
  isPremium: boolean;
  role: 'user' | 'admin' | 'moderator';
  wallet: WalletProfile | null;
  createdAt: string;
  lastSeenAt: string;
};

export type WalletProfile = {
  address: string;
  network: string;
  publicKey?: string | null;
  isVerified: boolean;
  connectedAt: string;
};

export type TokenItem = {
  id: string;
  name: string;
  ticker: string;
  description: string;
  imageUrl: string | null;
  websiteUrl: string | null;
  telegramUrl: string | null;
  twitterUrl: string | null;
  status: 'awaiting_deploy' | 'deploy_submitted' | 'funding' | 'curve_locked' | 'liquidity_pending' | 'graduated' | 'paused' | 'failed';
  feeBps: number;
  decimals: number;
  jettonMasterAddress: string | null;
  jettonContentUri: string | null;
  platformContractAddress: string | null;
  deployTxHash: string | null;
  currentSupplyAtomic: string;
  currentSupply: string;
  raisedTonNano: string;
  raisedTon: string;
  targetLiquidityNano: string;
  targetLiquidityTon: string;
  basePriceTon: string;
  slopeTon: string;
  currentPriceNano: string;
  currentPriceTon: string;
  marketCap: string;
  liquidity: string;
  holders: number;
  progressBps: number;
  progressPercent: number;
  dexName: string | null;
  dexPoolAddress: string | null;
  createdAt: string;
  graduatedAt: string | null;
};

export type BootstrapPayload = {
  me: UserProfile;
  tokens: TokenItem[];
  stats: {
    token_count: number;
    total_raised_nano: string;
    total_fees_nano: string;
  };
  config: {
    tonNetwork: string;
    platformFeeBps: number;
    platformAddress: string | null;
    publicAppUrl: string;
    jettonDeploy: {
      ready: boolean;
      missing: string[];
    };
  };
};

export type ApiError = {
  error: string;
  details?: unknown;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        HapticFeedback?: {
          impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
        };
      };
    };
  }
}
