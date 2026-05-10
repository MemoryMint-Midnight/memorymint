import type { NextFunction, Request, Response } from 'express';
import { NetworkError, ProofError, TxTimeoutError, WalletError } from '../midnight/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof TxTimeoutError) {
    res.status(202).json({
      status:  'pending',
      message: err.message,
      ...(err.txHash ? { txHash: err.txHash } : {}),
    });
    return;
  }
  if (err instanceof ProofError) {
    res.status(422).json({ error: err.message, circuit: err.circuit });
    return;
  }
  if (err instanceof NetworkError || err instanceof WalletError) {
    res.status(503).json({ error: err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: msg });
}
