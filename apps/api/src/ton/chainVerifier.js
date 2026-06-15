export async function verifyTonTransaction(_txHash, _expected) {
  // Production hook: wire TON Center v3 / TonAPI proof here and set REQUIRE_CHAIN_VERIFICATION=true.
  // The project intentionally does not auto-credit fake local hashes in production mode.
  if (process.env.REQUIRE_CHAIN_VERIFICATION === 'true') {
    throw new Error('Chain verification is enabled, but TON verifier adapter is not configured yet');
  }
  return { verified: false, mode: 'local-unverified' };
}
