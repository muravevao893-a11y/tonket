import { beginCell } from '@ton/core';

export function buildCommentPayload(comment) {
  return beginCell().storeUint(0, 32).storeStringTail(comment).endCell().toBoc().toString('base64');
}

export function buildTonConnectTransaction({ to, amountNano, payload, stateInit, validForSeconds = 600 }) {
  if (!to) throw new Error('Transaction recipient address is required');
  if (!amountNano) throw new Error('Transaction amount is required');

  const message = {
    address: to,
    amount: String(amountNano),
  };

  if (payload) message.payload = payload;
  if (stateInit) message.stateInit = stateInit;

  return {
    validUntil: Math.floor(Date.now() / 1000) + validForSeconds,
    messages: [message],
  };
}
