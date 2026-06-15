import assert from 'node:assert/strict';
import { parseTonToNano, parseTokenAmount, quoteBuy, quoteSell } from '../src/services/bondingCurve.js';

const basePriceNano = parseTonToNano('0.001');
const slopeNano = parseTonToNano('0.000001');
const amountAtomic = parseTokenAmount('1000');

const buy = quoteBuy({
  supplyAtomic: '0',
  amountAtomic,
  basePriceNano,
  slopeNano,
  feeBps: 100,
});

assert.equal(buy.side, 'buy');
assert.ok(BigInt(buy.totalTonNano) > BigInt(buy.grossTonNano));
assert.equal(buy.supplyAfterAtomic, amountAtomic.toString());

const sell = quoteSell({
  supplyAtomic: buy.supplyAfterAtomic,
  amountAtomic: parseTokenAmount('100'),
  basePriceNano,
  slopeNano,
  feeBps: 100,
});
assert.equal(sell.side, 'sell');
assert.ok(BigInt(sell.netTonNano) < BigInt(sell.grossTonNano));

console.log('Bonding curve tests passed');
