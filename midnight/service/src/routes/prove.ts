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
 * }
 *
 * Response: { proofType, txId, verified: true }
 */

import { Router } from 'express';
import { z } from 'zod';
import { callCircuit } from '../midnight/contract.js';

export const proveRouter = Router({ mergeParams: true });

const ProveBody = z.discriminatedUnion('proofType', [
  z.object({
    proofType:    z.literal('ownership'),
    userMnemonic: z.string().min(1),
  }),
  z.object({
    proofType:       z.literal('created_before'),
    userMnemonic:    z.string().min(1),
    cutoffTimestamp: z.number().int().positive(),
  }),
  z.object({
    proofType:    z.literal('contains_tag'),
    userMnemonic: z.string().min(1),
  }),
  z.object({
    proofType:    z.literal('content_authentic'),
    userMnemonic: z.string().min(1),
  }),
]);

const circuitMap: Record<string, string> = {
  ownership:        'proveOwnership',
  created_before:   'proveCreatedBefore',
  contains_tag:     'proveContainsTag',
  content_authentic:'proveContentAuthentic',
};

proveRouter.post('/', async (req, res) => {
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

  try {
    const txId = await callCircuit(contractAddress, circuit, body.userMnemonic, {}, circuitArgs);
    res.json({ proofType: body.proofType, txId, verified: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('assertion failed') || message.includes('assert')) {
      res.status(422).json({ error: 'Proof failed: assertion not satisfied', details: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});
