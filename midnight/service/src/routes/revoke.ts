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
 * Response:
 * { txHash: string }
 */

import { Router } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';

export const revokeRouter = Router({ mergeParams: true });

const RevokeBody = z.object({
  userMnemonic: z.string().regex(/^([a-z]+)( [a-z]+){11,23}$/, 'must be a 12- or 24-word BIP-39 mnemonic'),
});

revokeRouter.post('/', async (req, res) => {
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
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
