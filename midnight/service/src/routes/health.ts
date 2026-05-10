/**
 * GET /health
 *
 * Liveness check. Pings the proof server and reports the sidecar wallet's DUST
 * balance. Alert if dustBalance drops below 1 trillion (1T DUST).
 * Used by docker-compose healthcheck and your monitoring stack.
 */

import { Router } from 'express';
import * as Rx from 'rxjs';
import { MIDNIGHT } from '../config.js';
import { getProviders } from '../midnight/provider.js';

const DUST_WARN_THRESHOLD = 1_000_000_000_000n; // 1T DUST

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let proofServerOk = false;
  let proofServerError: string | null = null;
  let dustBalance: string | null = null;
  let dustWarning: string | null = null;

  // 3-second deadline for the dust balance — getProviders() can block for up to
  // 15 min during initial wallet sync, so we must not wait for it here.
  const DUST_TIMEOUT_MS = 3_000;
  const dustDeadline = new Promise<null>(resolve => setTimeout(() => resolve(null), DUST_TIMEOUT_MS));

  await Promise.allSettled([
    fetch(`${MIDNIGHT.proofServer}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => { proofServerOk = r.ok; })
      .catch(err => { proofServerError = err instanceof Error ? err.message : String(err); }),

    Promise.race([getProviders(), dustDeadline])
      .then(async (providersOrNull) => {
        if (!providersOrNull) return; // timed out — wallet still syncing
        const state = await Rx.firstValueFrom(providersOrNull.wallet.state());
        const coins: any[] = (state as any).dust?.state?.unspentCoins ?? [];
        const balance = coins.reduce((sum: bigint, c: any) => sum + BigInt(c.value ?? 0), 0n);
        dustBalance = balance.toString();
        if (balance < DUST_WARN_THRESHOLD) {
          dustWarning = `Low DUST balance: ${balance} (threshold: ${DUST_WARN_THRESHOLD})`;
        }
      })
      .catch(() => {
        // Provider init failed — report null, not an error
      }),
  ]);

  const httpStatus = proofServerOk ? 200 : 503;

  res.status(httpStatus).json({
    status:      proofServerOk ? 'ok' : 'degraded',
    proofServer: proofServerOk ? 'reachable' : `unreachable: ${proofServerError}`,
    dustBalance,
    dustWarning,
    midnight:    MIDNIGHT.indexer,
    timestamp:   new Date().toISOString(),
  });
});
