/**
 * POST /api/v1/midnight/:contractAddress/tag
 *
 * Adds a tag to a memory (increments tagCount on the Midnight contract).
 * Only the current owner can tag. The tag value itself is never stored
 * on-chain — only the count.
 *
 * Body (JSON):
 * { userMnemonic: string }   // BIP-39 mnemonic — sk derived internally
 *
 * Response:
 * { txHash: string }
 */

import { Router } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';

export const tagRouter = Router({ mergeParams: true });

const TagBody = z.object({
  userMnemonic: z.string().min(1, 'userMnemonic is required'),
});

tagRouter.post('/', async (req, res) => {
  const { contractAddress } = req.params as { contractAddress: string };

  const parsed = TagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  try {
    const txHash = await callCircuit(contractAddress, 'updateTag', parsed.data.userMnemonic, {});
    res.json({ txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
