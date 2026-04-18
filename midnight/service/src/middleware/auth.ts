import type { Request, Response, NextFunction } from 'express';
import { SERVICE } from '../config.js';

/**
 * Validates the shared API secret on every request.
 * The Next.js app (or WordPress plugin) must include:
 *   x-api-secret: <MIDNIGHT_API_SECRET>
 *
 * This prevents the sidecar from being called by anything other than
 * your own platform — it is not a public API.
 */
export function requireApiSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-api-secret'];

  if (!SERVICE.apiSecret) {
    // Misconfiguration — refuse all requests until the secret is set
    res.status(503).json({ error: 'Service misconfigured: MIDNIGHT_API_SECRET not set' });
    return;
  }

  if (!provided || provided !== SERVICE.apiSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
