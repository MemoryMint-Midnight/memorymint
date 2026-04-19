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
 * Response:  { txHash: string }
 * Timeout:   { status: 'pending', message: string }  HTTP 202
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';

export const tagRouter = Router({ mergeParams: true });

const TagBody = z.object({
  userMnemonic: z.string().min(1, 'userMnemonic is required'),
});

tagRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
    next(err);
  }
});
