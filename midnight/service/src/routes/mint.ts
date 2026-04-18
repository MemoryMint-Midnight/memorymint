/**
 * POST /api/v1/midnight/mint
 *
 * Called after a Cardano NFT is minted. Deploys a memory_token contract on
 * Midnight and returns the contract address to store alongside the Cardano asset.
 *
 * Body (JSON):
 * {
 *   userMnemonic:   string,   // user's BIP-39 mnemonic — sk derived internally
 *   contentHash:    string,   // hex 32 bytes — SHA-256 of raw memory content
 *   timestamp:      number,   // Unix epoch seconds
 *   geoHash:        string,   // hex 32 bytes — SHA-256 of location ("" → zero bytes)
 *   tagCount:       number,
 *   cardanoAssetId: string,   // hex 32 bytes — SHA-256 of (policyId ++ assetName)
 * }
 *
 * Response: { contractAddress: string }
 */

import { Router } from 'express';
import { z } from 'zod';
import { deployMemoryToken } from '../midnight/contract.js';

export const mintRouter = Router();

const hexBytes32 = z.string().regex(/^[0-9a-f]{64}$/, 'must be 32-byte hex');

const MintBody = z.object({
  userMnemonic:   z.string().min(1, 'userMnemonic is required'),
  contentHash:    hexBytes32,
  timestamp:      z.number().int().positive(),
  geoHash:        hexBytes32,
  tagCount:       z.number().int().min(0),
  cardanoAssetId: hexBytes32,
});

mintRouter.post('/', async (req, res) => {
  const parsed = MintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;

  try {
    const contractAddress = await deployMemoryToken({
      userMnemonic:   body.userMnemonic,
      contentHash:    hexToBytes(body.contentHash),
      timestamp:      BigInt(body.timestamp),
      geoHash:        hexToBytes(body.geoHash),
      tagCount:       BigInt(body.tagCount),
      cardanoAssetId: hexToBytes(body.cardanoAssetId),
    });
    res.json({ contractAddress });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : undefined;
    console.error('[mint] Error:', message, cause ? `| cause: ${cause}` : '', err);
    res.status(500).json({ error: message, cause, stack });
  }
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
