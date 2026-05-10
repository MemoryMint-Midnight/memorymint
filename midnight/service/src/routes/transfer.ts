/**
 * POST /api/v1/midnight/:contractAddress/transfer
 *
 * Called after a Cardano NFT transfer completes. Updates the owner commitment
 * on the Midnight contract so the private metadata stays linked to the new owner.
 *
 * Body (JSON):
 * {
 *   userMnemonic:      string,   // current owner's BIP-39 mnemonic
 *   newOwnerSecretKey: string,   // new owner's 32-byte Midnight sk as 64-char hex
 *                                // derived by WordPress: PBKDF2-SHA512(mnemonic, 'mnemonic', 2048, 64) → HMAC-SHA256 w/ domain
 *                                // The raw mnemonic never leaves WordPress.
 * }
 *
 * Response:  { txHash: string }
 * Timeout:   { status: 'pending', message: string }  HTTP 202
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { Buffer } from 'buffer';
import { callCircuit } from '../midnight/contract.js';
import { commitmentFromSecretKey } from '../midnight/provider.js';
import { mnemonicSchema } from '../lib/schemas.js';

export const transferRouter = Router({ mergeParams: true });

const TransferBody = z.object({
  userMnemonic:      mnemonicSchema,
  newOwnerSecretKey: z.string().regex(/^[0-9a-f]{64}$/i, 'newOwnerSecretKey must be 64-char hex (32 bytes)'),
});

transferRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { contractAddress } = req.params as { contractAddress: string };

  const parsed = TransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { userMnemonic, newOwnerSecretKey } = parsed.data;

  try {
    const newOwnerCommit = commitmentFromSecretKey(Buffer.from(newOwnerSecretKey, 'hex'));
    const txHash = await callCircuit(
      contractAddress,
      'transferMemory',
      userMnemonic,
      { newOwnerCommit },
    );
    res.json({ txHash });
  } catch (err) {
    next(err);
  }
});
