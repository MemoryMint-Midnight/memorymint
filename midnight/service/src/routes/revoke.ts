/**
 * POST /api/v1/midnight/:contractAddress/revoke
 *
 * Permanently revokes a memory on the Midnight contract. Irreversible.
 * Only the current owner can revoke. All subsequent circuit calls
 * (prove, transfer, tag) will reject after revocation.
 *
 * Body (JSON):
 * { userMnemonic: string }   // user's BIP-39 mnemonic — sk derived internally
 *
 * Response:  { txHash: string }
 * Timeout:   { status: 'pending', message: string }  HTTP 202
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';
import { mnemonicSchema } from '../lib/schemas.js';

export const revokeRouter = Router({ mergeParams: true });

const RevokeBody = z.object({
  userMnemonic: mnemonicSchema,
});

revokeRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { contractAddress } = req.params as { contractAddress: string };

  const parsed = RevokeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  try {
    const txHash = await callCircuit(contractAddress, 'revokeMemory', parsed.data.userMnemonic, {});
    res.json({ txHash });
  } catch (err) {
    next(err);
  }
});
