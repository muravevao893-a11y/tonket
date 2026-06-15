export type Token = {
  id: string;
  name: string;
  ticker: string;
  description: string;
  avatar: string;
  priceTon: number;
  change24h: number;
  marketCap: string;
  liquidity: string;
  holders: number;
  progress: number;
  creator: string;
  replies: number;
  isHot?: boolean;
  isNew?: boolean;
};

export const tokens: Token[] = [
  {
    id: '1',
    name: 'Durov Dog',
    ticker: 'DOGOV',
    description: 'The most serious dog on TON. Probably watching your bags.',
    avatar: '🐶',
    priceTon: 0.0042,
    change24h: 184,
    marketCap: '42.8K TON',
    liquidity: '18.2K TON',
    holders: 1284,
    progress: 72,
    creator: '@ton_memer',
    replies: 88,
    isHot: true,
  },
  {
    id: '2',
    name: 'Gas Goblin',
    ticker: 'GOB',
    description: 'Eats gas, prints memes, refuses to elaborate.',
    avatar: '👺',
    priceTon: 0.0019,
    change24h: 64,
    marketCap: '19.4K TON',
    liquidity: '8.7K TON',
    holders: 604,
    progress: 39,
    creator: '@curve_wizard',
    replies: 34,
    isNew: true,
  },
  {
    id: '3',
    name: 'Blue Rocket',
    ticker: 'BLURKT',
    description: 'A tiny rocket with a suspiciously confident community.',
    avatar: '🚀',
    priceTon: 0.0088,
    change24h: -12,
    marketCap: '86.1K TON',
    liquidity: '31.5K TON',
    holders: 2411,
    progress: 91,
    creator: '@launch_enjoyer',
    replies: 173,
    isHot: true,
  },
  {
    id: '4',
    name: 'Keyboard Whale',
    ticker: 'KWHL',
    description: 'Whale entered the chat. Keyboard survived. Market did not.',
    avatar: '🐳',
    priceTon: 0.0007,
    change24h: 23,
    marketCap: '7.9K TON',
    liquidity: '2.3K TON',
    holders: 214,
    progress: 16,
    creator: '@sleepy_builder',
    replies: 12,
  },
  {
    id: '5',
    name: 'Tap Hamster CEO',
    ticker: 'HAMCEO',
    description: 'Executive hamster. Very busy. Mostly tapping.',
    avatar: '🐹',
    priceTon: 0.0031,
    change24h: 97,
    marketCap: '33.6K TON',
    liquidity: '13.8K TON',
    holders: 932,
    progress: 58,
    creator: '@miniapp_degen',
    replies: 51,
    isNew: true,
  },
];
