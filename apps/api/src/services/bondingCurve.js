const TOKEN_DECIMALS = 9n;
const TOKEN_SCALE = 10n ** TOKEN_DECIMALS;
const TON_SCALE = 1_000_000_000n;

function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert value to BigInt: ${value}`);
}

export function parseDecimalToAtomic(input, decimals = 9) {
  const raw = String(input ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid decimal amount: ${input}`);
  const [whole, fraction = ''] = raw.split('.');
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

export function parseTonToNano(input) {
  return parseDecimalToAtomic(input, 9);
}

export function parseTokenAmount(input, decimals = 9) {
  return parseDecimalToAtomic(input, decimals);
}

export function formatAtomic(input, decimals = 9, maxFraction = 6) {
  const value = toBigInt(input);
  const scale = 10n ** BigInt(decimals);
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / scale;
  const fraction = abs % scale;
  let frac = fraction.toString().padStart(decimals, '0');
  frac = frac.slice(0, maxFraction).replace(/0+$/, '');
  return `${sign}${whole.toString()}${frac ? `.${frac}` : ''}`;
}

export function formatNanoTon(input, maxFraction = 6) {
  return formatAtomic(input, 9, maxFraction);
}

export function formatTokenAmount(input, decimals = 9, maxFraction = 2) {
  return formatAtomic(input, decimals, maxFraction);
}

// Linear bonding curve: price(s) = base + slope * s, where s is whole-token supply.
// Integration is done with integer math over atomic token units:
// cost = base * dx + slope * (s*dx + dx^2/2), normalized by TOKEN_SCALE.
export function priceAtSupply({ supplyAtomic, basePriceNano, slopeNano }) {
  const supply = toBigInt(supplyAtomic);
  const base = toBigInt(basePriceNano);
  const slope = toBigInt(slopeNano);
  return base + (slope * supply) / TOKEN_SCALE;
}

export function integralCost({ supplyAtomic, amountAtomic, basePriceNano, slopeNano }) {
  const supply = toBigInt(supplyAtomic);
  const amount = toBigInt(amountAtomic);
  const base = toBigInt(basePriceNano);
  const slope = toBigInt(slopeNano);
  if (amount <= 0n) throw new Error('Amount must be positive');

  const basePart = (base * amount) / TOKEN_SCALE;
  const linearArea = supply * amount + (amount * amount) / 2n;
  const slopePart = (slope * linearArea) / (TOKEN_SCALE * TOKEN_SCALE);
  return basePart + slopePart;
}

export function quoteBuy({ supplyAtomic, amountAtomic, basePriceNano, slopeNano, feeBps = 100 }) {
  const amount = toBigInt(amountAtomic);
  const gross = integralCost({ supplyAtomic, amountAtomic: amount, basePriceNano, slopeNano });
  const fee = (gross * BigInt(feeBps)) / 10_000n;
  const total = gross + fee;
  const supplyAfter = toBigInt(supplyAtomic) + amount;
  return {
    side: 'buy',
    amountAtomic: amount.toString(),
    grossTonNano: gross.toString(),
    feeTonNano: fee.toString(),
    totalTonNano: total.toString(),
    netTonNano: gross.toString(),
    priceStartNano: priceAtSupply({ supplyAtomic, basePriceNano, slopeNano }).toString(),
    priceEndNano: priceAtSupply({ supplyAtomic: supplyAfter, basePriceNano, slopeNano }).toString(),
    supplyBeforeAtomic: toBigInt(supplyAtomic).toString(),
    supplyAfterAtomic: supplyAfter.toString(),
  };
}

export function quoteSell({ supplyAtomic, amountAtomic, basePriceNano, slopeNano, feeBps = 100 }) {
  const supply = toBigInt(supplyAtomic);
  const amount = toBigInt(amountAtomic);
  if (amount <= 0n) throw new Error('Amount must be positive');
  if (amount > supply) throw new Error('Cannot sell more than current supply');

  const supplyAfter = supply - amount;
  const gross = integralCost({ supplyAtomic: supplyAfter, amountAtomic: amount, basePriceNano, slopeNano });
  const fee = (gross * BigInt(feeBps)) / 10_000n;
  const payout = gross - fee;

  return {
    side: 'sell',
    amountAtomic: amount.toString(),
    grossTonNano: gross.toString(),
    feeTonNano: fee.toString(),
    totalTonNano: payout.toString(),
    netTonNano: payout.toString(),
    priceStartNano: priceAtSupply({ supplyAtomic, basePriceNano, slopeNano }).toString(),
    priceEndNano: priceAtSupply({ supplyAtomic: supplyAfter, basePriceNano, slopeNano }).toString(),
    supplyBeforeAtomic: supply.toString(),
    supplyAfterAtomic: supplyAfter.toString(),
  };
}

export function quoteToPublic(quote) {
  return {
    ...quote,
    amount: formatTokenAmount(quote.amountAtomic),
    grossTon: formatNanoTon(quote.grossTonNano),
    feeTon: formatNanoTon(quote.feeTonNano),
    totalTon: formatNanoTon(quote.totalTonNano),
    netTon: formatNanoTon(quote.netTonNano),
    priceStartTon: formatNanoTon(quote.priceStartNano),
    priceEndTon: formatNanoTon(quote.priceEndNano),
  };
}

export { TON_SCALE, TOKEN_SCALE };
