export async function createStonFiGraduationDraft(token) {
  return {
    enabled: process.env.STONFI_ENABLED === 'true',
    dex: 'stonfi',
    routerAddress: process.env.STONFI_ROUTER_ADDRESS || null,
    tokenId: token.id,
    jettonMasterAddress: token.jetton_master_address,
    liquidityTonNano: token.raised_ton_nano,
    note: 'Use STON.fi SDK/API to create/provide liquidity after audit. This draft is stored to keep graduation deterministic.',
  };
}
