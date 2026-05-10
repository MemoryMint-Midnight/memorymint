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
 * Response:  { contractAddress: string }
 * Timeout:   { status: 'pending', message: string }  HTTP 202
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { deployMemoryToken } from '../midnight/contract.js';

export const mintRouter = Router();

// Each mint takes 10-15 min — one request per 30s per IP is generous and safe.
const mintRateLimiter = rateLimit({
  windowMs:         30_000,
  limit:            1,
  standardHeaders:  'draft-7',
  legacyHeaders:    false,
  message:          { error: 'Too many mint requests. Each mint takes 10-15 minutes — please wait before retrying.' },
});

const hexBytes32 = z.string().regex(/^[0-9a-f]{64}$/, 'must be 32-byte hex');

const MintBody = z.object({
  userMnemonic:   z.string().min(1, 'userMnemonic is required'),
  contentHash:    hexBytes32,
  timestamp:      z.number().int().positive(),
  geoHash:        hexBytes32,
  tagCount:       z.number().int().min(0),
  cardanoAssetId: hexBytes32,
});

mintRouter.post('/', mintRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
    next(err);
  }
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
