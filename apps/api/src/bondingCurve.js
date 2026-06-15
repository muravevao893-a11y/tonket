const TON_SCALE = 1_000_000_000n;
const TOKEN_SCALE = 1_000_000_000n;
const BPS_SCALE = 10_000n;

function toBigInt(value, fieldName = 'value') {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${fieldName} must be an integer-compatible value`);
  }
}

function mulDivFloor(a, b, denominator) {
  if (denominator <= 0n) throw new Error('denominator must be positive');
  return (a * b) / denominator;
}

function mulDivCeil(a, b, denominator) {
  if (denominator <= 0n) throw new Error('denominator must be positive');
  const product = a * b;
  return (product + denominator - 1n) / denominator;
}

export function parseTonToNano(input) {
  if (typeof input !== 'string') input = String(input);
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,9})?$/.test(normalized)) {
    throw new Error('TON value must be a positive decimal with max 9 decimals');
  }
  const [whole, frac = ''] = normalized.split('.');
  return BigInt(whole) * TON_SCALE + BigInt((frac + '0'.repeat(9)).slice(0, 9));
}

export function formatNanoTon(value) {
  const nano = toBigInt(value);
  const sign = nano < 0n ? '-' : '';
  const abs = nano < 0n ? -nano : nano;
  const whole = abs / TON_SCALE;
  const frac = String(abs % TON_SCALE).padStart(9, '0').replace(/0+$/, '');
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

export function parseTokenAmount(input) {
  if (typeof input !== 'string') input = String(input);
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,9})?$/.test(normalized)) {
    throw new Error('Token amount must be a positive decimal with max 9 decimals');
  }
  const [whole, frac = ''] = normalized.split('.');
  const atomic = BigInt(whole) * TOKEN_SCALE + BigInt((frac + '0'.repeat(9)).slice(0, 9));
  if (atomic <= 0n) throw new Error('Token amount must be greater than zero');
  return atomic;
}

export function formatTokenAmount(value) {
  const atomic = toBigInt(value);
  const sign = atomic < 0n ? '-' : '';
  const abs = atomic < 0n ? -atomic : atomic;
  const whole = abs / TOKEN_SCALE;
  const frac = String(abs % TOKEN_SCALE).padStart(9, '0').replace(/0+$/, '');
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

export function priceAtSupply({ supplyAtomic, basePriceNano, slopeNano }) {
  const supply = toBigInt(supplyAtomic, 'supplyAtomic');
  const base = toBigInt(basePriceNano, 'basePriceNano');
  const slope = toBigInt(slopeNano, 'slopeNano');
  if (supply < 0n) throw new Error('supply cannot be negative');
  if (base <= 0n) throw new Error('base price must be positive');
  if (slope < 0n) throw new Error('slope cannot be negative');

  // price = base + slope * supplyWholeTokens
  return base + mulDivFloor(slope, supply, TOKEN_SCALE);
}

function linearIntegralCost({ fromSupplyAtomic, toSupplyAtomic, basePriceNano, slopeNano, roundUp }) {
  const from = toBigInt(fromSupplyAtomic, 'fromSupplyAtomic');
  const to = toBigInt(toSupplyAtomic, 'toSupplyAtomic');
  const base = toBigInt(basePriceNano, 'basePriceNano');
  const slope = toBigInt(slopeNano, 'slopeNano');
  if (to < from) throw new Error('toSupplyAtomic must be >= fromSupplyAtomic');

  const amount = to - from;

  // ∫ base dx = base * amountTokens
  const baseCost = roundUp
    ? mulDivCeil(base, amount, TOKEN_SCALE)
    : mulDivFloor(base, amount, TOKEN_SCALE);

  // ∫ slope*x dx = slope * (to^2 - from^2) / 2
  // Since supply is in atomic units, divide by TOKEN_SCALE^2.
  const deltaSquare = to * to - from * from;
  const denominator = 2n * TOKEN_SCALE * TOKEN_SCALE;
  const curveCost = roundUp
    ? mulDivCeil(slope, deltaSquare, denominator)
    : mulDivFloor(slope, deltaSquare, denominator);

  return baseCost + curveCost;
}

export function quoteBuy({ supplyAtomic, amountAtomic, basePriceNano, slopeNano, feeBps }) {
  const supply = toBigInt(supplyAtomic, 'supplyAtomic');
  const amount = toBigInt(amountAtomic, 'amountAtomic');
  const bps = toBigInt(feeBps, 'feeBps');
  if (amount <= 0n) throw new Error('amount must be positive');
  if (bps < 0n || bps > BPS_SCALE) throw new Error('feeBps must be between 0 and 10000');

  const endSupply = supply + amount;
  const grossTonNano = linearIntegralCost({
    fromSupplyAtomic: supply,
    toSupplyAtomic: endSupply,
    basePriceNano,
    slopeNano,
    roundUp: true
  });
  const feeNano = mulDivCeil(grossTonNano, bps, BPS_SCALE);
  const totalTonNano = grossTonNano + feeNano;

  return {
    side: 'buy',
    amountAtomic: amount.toString(),
    grossTonNano: grossTonNano.toString(),
    feeNano: feeNano.toString(),
    totalTonNano: totalTonNano.toString(),
    netTonNano: grossTonNano.toString(),
    priceStartNano: priceAtSupply({ supplyAtomic: supply, basePriceNano, slopeNano }).toString(),
    priceEndNano: priceAtSupply({ supplyAtomic: endSupply, basePriceNano, slopeNano }).toString(),
    supplyBeforeAtomic: supply.toString(),
    supplyAfterAtomic: endSupply.toString()
  };
}

export function quoteSell({ supplyAtomic, amountAtomic, basePriceNano, slopeNano, feeBps }) {
  const supply = toBigInt(supplyAtomic, 'supplyAtomic');
  const amount = toBigInt(amountAtomic, 'amountAtomic');
  const bps = toBigInt(feeBps, 'feeBps');
  if (amount <= 0n) throw new Error('amount must be positive');
  if (amount > supply) throw new Error('cannot sell more than current curve supply');
  if (bps < 0n || bps > BPS_SCALE) throw new Error('feeBps must be between 0 and 10000');

  const startSupply = supply - amount;
  const grossTonNano = linearIntegralCost({
    fromSupplyAtomic: startSupply,
    toSupplyAtomic: supply,
    basePriceNano,
    slopeNano,
    roundUp: false
  });
  const feeNano = mulDivCeil(grossTonNano, bps, BPS_SCALE);
  const totalTonNano = grossTonNano;
  const netTonNano = grossTonNano - feeNano;

  return {
    side: 'sell',
    amountAtomic: amount.toString(),
    grossTonNano: grossTonNano.toString(),
    feeNano: feeNano.toString(),
    totalTonNano: totalTonNano.toString(),
    netTonNano: netTonNano.toString(),
    priceStartNano: priceAtSupply({ supplyAtomic: supply, basePriceNano, slopeNano }).toString(),
    priceEndNano: priceAtSupply({ supplyAtomic: startSupply, basePriceNano, slopeNano }).toString(),
    supplyBeforeAtomic: supply.toString(),
    supplyAfterAtomic: startSupply.toString()
  };
}

export function publicQuote(quote) {
  return {
    ...quote,
    amountTokens: formatTokenAmount(quote.amountAtomic),
    grossTon: formatNanoTon(quote.grossTonNano),
    feeTon: formatNanoTon(quote.feeNano),
    totalTon: formatNanoTon(quote.totalTonNano),
    netTon: formatNanoTon(quote.netTonNano),
    priceStartTon: formatNanoTon(quote.priceStartNano),
    priceEndTon: formatNanoTon(quote.priceEndNano),
    supplyBeforeTokens: formatTokenAmount(quote.supplyBeforeAtomic),
    supplyAfterTokens: formatTokenAmount(quote.supplyAfterAtomic)
  };
}
