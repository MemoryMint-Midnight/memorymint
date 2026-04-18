/**
 * GET /health
 *
 * Liveness check. Also pings the proof server to confirm it is reachable.
 * Used by docker-compose healthcheck and your monitoring stack.
 */

import { Router } from 'express';
import { MIDNIGHT } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let proofServerOk = false;
  let proofServerError: string | null = null;

  try {
    const response = await fetch(`${MIDNIGHT.proofServer}/health`, { signal: AbortSignal.timeout(3000) });
    proofServerOk = response.ok;
  } catch (err) {
    proofServerError = err instanceof Error ? err.message : String(err);
  }

  const status = proofServerOk ? 200 : 503;

  res.status(status).json({
    status:      proofServerOk ? 'ok' : 'degraded',
    proofServer: proofServerOk ? 'reachable' : `unreachable: ${proofServerError}`,
    midnight:    MIDNIGHT.indexer,
    timestamp:   new Date().toISOString(),
  });
});
