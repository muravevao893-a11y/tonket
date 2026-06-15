import { beginCell } from '@ton/core';

export function commentToPayload(comment) {
  return beginCell()
    .storeUint(0, 32)
    .storeStringTail(comment)
    .endCell()
    .toBoc()
    .toString('base64');
}

export function buildTonConnectTransaction({ address, amountNano, comment, ttlSeconds = 300 }) {
  if (!address) throw new Error('platform TON address is not configured');
  return {
    validUntil: Math.floor(Date.now() / 1000) + ttlSeconds,
    messages: [
      {
        address,
        amount: String(amountNano),
        payload: commentToPayload(comment)
      }
    ]
  };
}
