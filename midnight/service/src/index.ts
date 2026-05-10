/**
 * MemoryMint — Midnight sidecar service
 *
 * Bridges the Next.js frontend / WordPress plugin with the Midnight Network.
 * Must run on the same host as the proof server (always localhost:6300).
 *
 * Start:  npm run service:dev   (dev — tsx watch)
 *         npm run service:start (prod — compiled JS)
 */

import express from 'express';
import cors from 'cors';
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { validateConfig, SERVICE } from './config.js';
import { requireApiSecret } from './middleware/auth.js';
import { getProviders } from './midnight/provider.js';
import { healthRouter } from './routes/health.js';
import { mintRouter } from './routes/mint.js';
import { proveRouter } from './routes/prove.js';
import { transferRouter } from './routes/transfer.js';
import { tagRouter } from './routes/tag.js';
import { revokeRouter } from './routes/revoke.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';

// Must be set before any wallet or contract operation.
// Override with MIDNIGHT_NETWORK_ID=mainnet for production.
setNetworkId((process.env.MIDNIGHT_NETWORK_ID ?? 'preprod') as NetworkId);

// Prevent ECONNRESET / WebSocket errors from crashing the process
process.on('uncaughtException', (err: Error) => {
  logger.error({ err }, 'Uncaught exception (service staying up)');
});
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled rejection (service staying up)');
});

// Validate config on startup — crashes immediately if env vars are missing
validateConfig();

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// CORS: validate origin against an explicit allowlist.
// Set CORS_ALLOWED_ORIGINS as a comma-separated list for multi-origin support
// (e.g. "https://memorymint.fun,https://www.memorymint.fun").
// Falls back to NEXT_PUBLIC_URL for single-origin setups.
const allowedOrigins: string[] = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS: rejected origin');
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST'],
}));

// ── Public routes ─────────────────────────────────────────────────────────────

// Health check — no auth required (used by docker healthcheck)
app.use('/health', healthRouter);

// ── Protected routes — require x-api-secret header ───────────────────────────

app.use('/api/v1/midnight', requireApiSecret);

// POST /api/v1/midnight/mint
app.use('/api/v1/midnight/mint', mintRouter);

// POST /api/v1/midnight/:contractAddress/prove
app.use('/api/v1/midnight/:contractAddress/prove', proveRouter);

// POST /api/v1/midnight/:contractAddress/transfer
app.use('/api/v1/midnight/:contractAddress/transfer', transferRouter);

// POST /api/v1/midnight/:contractAddress/tag
app.use('/api/v1/midnight/:contractAddress/tag', tagRouter);

// POST /api/v1/midnight/:contractAddress/revoke
app.use('/api/v1/midnight/:contractAddress/revoke', revokeRouter);

// ── 404 fallback ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Central error handler (must be last) ──────────────────────────────────────

app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(SERVICE.port, () => {
  logger.info({ port: SERVICE.port }, 'Listening');
  logger.info({ proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300' }, 'Proof server');
  logger.info({ url: `http://localhost:${SERVICE.port}/health` }, 'Health endpoint');

  // Eagerly initialise the wallet so it's synced before the first request arrives
  getProviders().then(() => {
    logger.info('Wallet ready');
  }).catch((err: unknown) => {
    logger.error({ err }, 'Wallet init failed');
  });
});
