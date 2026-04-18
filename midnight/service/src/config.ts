import 'dotenv/config';

// ── Midnight network (preprod by default) ─────────────────────────────────────
export const MIDNIGHT = {
  indexer:     process.env.MIDNIGHT_INDEXER     ?? 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS:   process.env.MIDNIGHT_INDEXER_WS  ?? 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node:        process.env.MIDNIGHT_NODE         ?? 'https://rpc.preprod.midnight.network',
  proofServer: process.env.PROOF_SERVER_URL      ?? 'http://127.0.0.1:6300',
} as const;

// ── Service ───────────────────────────────────────────────────────────────────
export const SERVICE = {
  port:      parseInt(process.env.PORT ?? '4000', 10),
  // Secret key used to sign JWTs issued by the WordPress plugin.
  // The sidecar validates these to confirm the caller is an authenticated user.
  jwtSecret: process.env.MIDNIGHT_JWT_SECRET ?? '',
  // Shared secret between Next.js/WordPress and this sidecar.
  // Set the same value in both places — prevents unauthenticated calls.
  apiSecret: process.env.MIDNIGHT_API_SECRET ?? '',
} as const;

// ── Wallet seed (server-side wallet for deploying contracts) ──────────────────
// This wallet pays DUST fees for contract deployment.
// Generate once, store in .env — never commit.
export const WALLET = {
  seedPhrase: process.env.MIDNIGHT_WALLET_SEED ?? '',
} as const;

// ── Validate on startup ───────────────────────────────────────────────────────
export function validateConfig(): void {
  const missing: string[] = [];
  if (!WALLET.seedPhrase)  missing.push('MIDNIGHT_WALLET_SEED');
  if (!SERVICE.apiSecret)  missing.push('MIDNIGHT_API_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `[midnight-service] Missing required env vars: ${missing.join(', ')}\n` +
      'Copy midnight/.env.example to midnight/.env and fill in the values.'
    );
  }
}
