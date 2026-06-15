import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { buildTonConnectTransaction } from './tonConnect.js';

function env(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function getJettonDeployConfigStatus() {
  const missing = [];
  if (!env('JETTON_MASTER_CODE_BOC_BASE64')) missing.push('JETTON_MASTER_CODE_BOC_BASE64');
  if (!env('JETTON_WALLET_CODE_BOC_BASE64')) missing.push('JETTON_WALLET_CODE_BOC_BASE64');
  if (!env('PLATFORM_ADMIN_TON_ADDRESS')) missing.push('PLATFORM_ADMIN_TON_ADDRESS');
  return {
    ready: missing.length === 0,
    missing,
  };
}

function offchainContentCell(uri) {
  return beginCell().storeUint(1, 8).storeStringTail(uri).endCell();
}

export function buildJettonDeployPlan(token) {
  const status = getJettonDeployConfigStatus();
  if (!status.ready) {
    return {
      ready: false,
      missing: status.missing,
      reason: 'Jetton contract BOC configuration is missing. Add audited Jetton Master/Wallet BOC values to environment variables.',
    };
  }

  const masterCode = Cell.fromBase64(env('JETTON_MASTER_CODE_BOC_BASE64'));
  const walletCode = Cell.fromBase64(env('JETTON_WALLET_CODE_BOC_BASE64'));
  const adminAddress = Address.parse(env('PLATFORM_ADMIN_TON_ADDRESS'));
  const workchain = Number(process.env.TON_WORKCHAIN || 0);
  const metadataBase = env('JETTON_METADATA_BASE_URL') || `${env('PUBLIC_APP_URL') || 'http://localhost:8080'}/api/jetton/metadata`;
  const contentUri = `${metadataBase.replace(/\/$/, '')}/${token.id}.json`;

  // Standard Jetton minter data layout used by common TON Jetton minter contracts:
  // total_supply, admin_address, content, jetton_wallet_code.
  const data = beginCell()
    .storeCoins(0n)
    .storeAddress(adminAddress)
    .storeRef(offchainContentCell(contentUri))
    .storeRef(walletCode)
    .endCell();

  const stateInit = { code: masterCode, data };
  const stateInitCell = beginCell().store(storeStateInit(stateInit)).endCell();
  const jettonAddress = contractAddress(workchain, stateInit).toString({ bounceable: true, urlSafe: true });
  const amountNano = BigInt(Math.round(Number(process.env.JETTON_DEPLOY_AMOUNT_TON || '0.08') * 1_000_000_000)).toString();

  return {
    ready: true,
    jettonMasterAddress: jettonAddress,
    contentUri,
    transaction: buildTonConnectTransaction({
      to: jettonAddress,
      amountNano,
      stateInit: stateInitCell.toBoc().toString('base64'),
      validForSeconds: 900,
    }),
  };
}
