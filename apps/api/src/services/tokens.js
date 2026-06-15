import { priceAtSupply, formatNanoTon, formatTokenAmount } from './bondingCurve.js';

function compactTon(nano) {
  const value = Number(BigInt(String(nano)) / 1_000_000n) / 1000;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K TON`;
  return `${value.toFixed(value >= 10 ? 1 : 3)} TON`;
}

export function tokenToPublic(row, holderCount = undefined) {
  const currentPriceNano = priceAtSupply({
    supplyAtomic: row.current_supply_atomic,
    basePriceNano: row.base_price_nano,
    slopeNano: row.slope_nano,
  }).toString();

  const raised = BigInt(row.raised_ton_nano || '0');
  const target = BigInt(row.target_liquidity_nano || '1');
  const progressBps = target === 0n ? 0 : Number((raised * 10_000n) / target);
  const progressPercent = Math.max(0, Math.min(100, progressBps / 100));

  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    description: row.description,
    imageUrl: row.image_url,
    websiteUrl: row.website_url,
    telegramUrl: row.telegram_url,
    twitterUrl: row.twitter_url,
    status: row.status,
    feeBps: row.fee_bps,
    decimals: row.decimals,
    jettonMasterAddress: row.jetton_master_address,
    jettonContentUri: row.jetton_content_uri,
    platformContractAddress: row.platform_contract_address,
    deployTxHash: row.jetton_deploy_tx_hash,
    currentSupplyAtomic: row.current_supply_atomic,
    currentSupply: formatTokenAmount(row.current_supply_atomic, row.decimals || 9, 2),
    raisedTonNano: row.raised_ton_nano,
    raisedTon: formatNanoTon(row.raised_ton_nano, 3),
    targetLiquidityNano: row.target_liquidity_nano,
    targetLiquidityTon: formatNanoTon(row.target_liquidity_nano, 3),
    basePriceTon: formatNanoTon(row.base_price_nano, 6),
    slopeTon: formatNanoTon(row.slope_nano, 9),
    currentPriceNano,
    currentPriceTon: formatNanoTon(currentPriceNano, 6),
    marketCap: compactTon((BigInt(currentPriceNano) * BigInt(row.current_supply_atomic || '0')) / 1_000_000_000n),
    liquidity: compactTon(row.raised_ton_nano),
    holders: Number(holderCount ?? row.holder_count ?? 0),
    progressBps,
    progressPercent,
    dexName: row.dex_name,
    dexPoolAddress: row.dex_pool_address,
    createdAt: row.created_at,
    graduatedAt: row.graduated_at,
  };
}

export async function getTokenById(client, tokenId, lock = false) {
  const result = await client.query(`SELECT * FROM tokens WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [tokenId]);
  return result.rows[0] || null;
}
