import { z } from 'zod';

/**
 * Shared Zod schema for BIP-39 mnemonic fields.
 * Enforces 12- or 24-word lowercase format before the value reaches the SDK,
 * which would otherwise surface confusing internal errors on bad input.
 */
export const mnemonicSchema = z
  .string()
  .regex(/^([a-z]+)( [a-z]+){11,23}$/, 'must be a 12- or 24-word BIP-39 mnemonic');
