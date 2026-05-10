/**
 * POST /api/v1/midnight/:contractAddress/prove
 *
 * Generates a ZK proof for a memory attribute without revealing the data.
 *
 * Body (JSON):
 * {
 *   proofType:        "ownership" | "created_before" | "contains_tag" | "content_authentic",
 *   userMnemonic:     string,   // BIP-39 mnemonic — sk derived internally
 *   cutoffTimestamp?: number,   // required for "created_before" (public circuit arg)
 *   contentHash?:     string,   // required for "content_authentic" — 64-char hex SHA-256 of content
 * }
 *
 * Response:  { proofType, txId, verified: true }
 * Timeout:   { status: 'pending', message: string }  HTTP 202
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';
import { mnemonicSchema } from '../lib/schemas.js';

export const proveRouter = Router({ mergeParams: true });

const ProveBody = z.discriminatedUnion('proofType', [
  z.object({
    proofType:    z.literal('ownership'),
    userMnemonic: mnemonicSchema,
  }),
  z.object({
    proofType:       z.literal('created_before'),
    userMnemonic:    mnemonicSchema,
    cutoffTimestamp: z.number().int().positive(),
  }),
  z.object({
    proofType:    z.literal('contains_tag'),
    userMnemonic: mnemonicSchema,
  }),
  z.object({
    proofType:    z.literal('content_authentic'),
    userMnemonic: mnemonicSchema,
    contentHash:  z.string().regex(/^[0-9a-f]{64}$/i, 'contentHash must be a 64-char hex SHA-256'),
  }),
]);

const circuitMap: Record<string, string> = {
  ownership:         'proveOwnership',
  created_before:    'proveCreatedBefore',
  contains_tag:      'proveContainsTag',
  content_authentic: 'proveContentAuthentic',
};

proveRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const { contractAddress } = req.params as { contractAddress: string };

  const parsed = ProveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const body    = parsed.data;
  const circuit = circuitMap[body.proofType];

  // cutoffTimestamp is a public circuit argument for created_before, not private state
  const circuitArgs: unknown[] =
    body.proofType === 'created_before' ? [BigInt(body.cutoffTimestamp)] : [];

  // content_authentic: pass contentHash as Uint8Array matching MemoryPrivateState.contentHash
  const privateStateUpdates =
    body.proofType === 'content_authentic'
      ? { contentHash: Buffer.from(body.contentHash, 'hex') }
      : {};

  try {
    const txId = await callCircuit(contractAddress, circuit, body.userMnemonic, privateStateUpdates, circuitArgs);
    res.json({ proofType: body.proofType, txId, verified: true });
  } catch (err) {
    next(err);
  }
});
