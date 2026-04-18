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
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { validateConfig, SERVICE } from './config.js';
import { requireApiSecret } from './middleware/auth.js';
import { getProviders } from './midnight/provider.js';
import { healthRouter } from './routes/health.js';
import { mintRouter } from './routes/mint.js';
import { proveRouter } from './routes/prove.js';
import { transferRouter } from './routes/transfer.js';
import { tagRouter } from './routes/tag.js';
import { revokeRouter } from './routes/revoke.js';

// Must be set before any wallet or contract operation
setNetworkId('preprod');

// Prevent ECONNRESET / WebSocket errors from crashing the process
process.on('uncaughtException', (err: Error) => {
  console.error('[midnight-service] Uncaught exception (service staying up):', err.message);
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[midnight-service] Unhandled rejection (service staying up):', reason);
});

// Validate config on startup — crashes immediately if env vars are missing
validateConfig();

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));

// CORS: only accept requests from the Next.js origin
app.use(cors({
  origin: process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000',
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

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(SERVICE.port, () => {
  console.log(`[midnight-service] Listening on port ${SERVICE.port}`);
  console.log(`[midnight-service] Proof server: ${process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300'}`);
  console.log(`[midnight-service] Health: http://localhost:${SERVICE.port}/health`);

  // Eagerly initialise the wallet so it's synced before the first request arrives
  getProviders().then(() => {
    console.log('[midnight-service] Wallet ready');
  }).catch((err) => {
    console.error('[midnight-service] Wallet init failed:', err);
  });
});
