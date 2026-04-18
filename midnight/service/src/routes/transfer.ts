/**
 * POST /api/v1/midnight/:contractAddress/transfer
 *
 * Called after a Cardano NFT transfer completes. Updates the owner commitment
 * on the Midnight contract so the private metadata stays linked to the new owner.
 *
 * Body (JSON):
 * {
 *   userMnemonic:     string,   // current owner's BIP-39 mnemonic
 *   newOwnerMnemonic: string,   // new owner's BIP-39 mnemonic — commitment computed server-side
 * }
 *
 * Response:
 * { txHash: string }
 */

import { Router } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';
import { computeOwnerCommitment } from '../midnight/provider.js';

export const transferRouter = Router({ mergeParams: true });

const TransferBody = z.object({
  userMnemonic:     z.string().min(1, 'userMnemonic is required'),
  newOwnerMnemonic: z.string().min(1, 'newOwnerMnemonic is required'),
});

transferRouter.post('/', async (req, res) => {
  const { contractAddress } = req.params as { contractAddress: string };

  const parsed = TransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { userMnemonic, newOwnerMnemonic } = parsed.data;

  try {
    const newOwnerCommit = computeOwnerCommitment(newOwnerMnemonic);
    const txHash = await callCircuit(
      contractAddress,
      'transferMemory',
      userMnemonic,
      { newOwnerCommit },
    );
    res.json({ txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
