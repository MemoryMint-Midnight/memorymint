import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { Mutex } from 'async-mutex';
import { logger } from '../lib/logger.js';
import type {
  ImportPrivateStatesResult,
  ImportSigningKeysResult,
  InMemoryPrivateStateProvider,
  PrivateStateExport,
  SigningKeyExport,
} from './inMemoryPrivateStateProvider.js';

// One mutex per process — sufficient because the sidecar is a single instance.
// Guards the read-compute-write cycle so concurrent async calls can't interleave.
const _storeMutex = new Mutex();

// ── Serialization ─────────────────────────────────────────────────────────────
// Custom replacer/reviver handles bigint and Uint8Array anywhere in the state graph.

function serialize(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint')      return { __bigint: v.toString() };
    if (v instanceof Uint8Array)    return { __uint8: Buffer.from(v).toString('hex') };
    return v;
  });
}

function deserialize(json: string): unknown {
  return JSON.parse(json, (_k, v) => {
    if (v && typeof v === 'object' && '__bigint' in v) return BigInt(v.__bigint as string);
    if (v && typeof v === 'object' && '__uint8'  in v) return Uint8Array.from(Buffer.from(v.__uint8 as string, 'hex'));
    return v;
  });
}

// ── Encryption (AES-256-GCM) ─────────────────────────────────────────────────

function deriveKey(secret: string): Buffer {
  return createHash('sha256')
    .update('memorymint:private-state:aes-key:v1')
    .update(secret)
    .digest();
}

function deriveExportKey(secret: string, salt: string): Buffer {
  return createHash('sha256')
    .update('memorymint:private-state:export-key:v1')
    .update(salt)
    .update(secret)
    .digest();
}

interface Ciphertext { iv: string; tag: string; ct: string; }

function encrypt(plain: string, key: Buffer): string {
  const iv     = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct     = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('base64'), tag: tag.toString('base64'), ct: ct.toString('base64') } as Ciphertext);
}

function decrypt(encoded: string, key: Buffer): string {
  const { iv, tag, ct } = JSON.parse(encoded) as Ciphertext;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

// ── File store ────────────────────────────────────────────────────────────────

interface FileStore {
  states:      Record<string, Record<string, string>>; // contractAddr → stateId → encrypted
  signingKeys: Record<string, string>;                 // contractAddr → encrypted
}

function loadStore(path: string): FileStore {
  if (!existsSync(path)) return { states: {}, signingKeys: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as FileStore;
  } catch {
    logger.warn('Corrupt state file — starting fresh');
    return { states: {}, signingKeys: {} };
  }
}

function saveStore(path: string, store: FileStore): void {
  mkdirSync(dirname(path), { recursive: true });
  const content = JSON.stringify(store);
  const tmp     = path + '.tmp';
  writeFileSync(tmp, content, 'utf8');
  try {
    renameSync(tmp, path); // atomic replace on same filesystem
  } catch {
    writeFileSync(path, content, 'utf8'); // fallback if rename fails on Windows
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function filePrivateStateProvider<PSI extends string = string, PS = unknown>(
  filePath: string,
  apiSecret: string,
): InMemoryPrivateStateProvider<PSI, PS> {
  const key = deriveKey(apiSecret);
  let currentAddress = '';

  return {
    setContractAddress(address: string): void {
      currentAddress = address;
    },

    async set(id: PSI, state: PS): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        if (!store.states[currentAddress]) store.states[currentAddress] = {};
        store.states[currentAddress][id as string] = encrypt(serialize(state), key);
        saveStore(filePath, store);
      });
    },

    async get(id: PSI): Promise<PS | null> {
      const store = loadStore(filePath);
      const enc   = store.states[currentAddress]?.[id as string];
      if (!enc) return null;
      try {
        return deserialize(decrypt(enc, key)) as PS;
      } catch {
        logger.warn({ address: currentAddress, id: String(id) }, 'Decrypt failed');
        return null;
      }
    },

    async remove(id: PSI): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        delete store.states[currentAddress]?.[id as string];
        saveStore(filePath, store);
      });
    },

    async clear(): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        delete store.states[currentAddress];
        saveStore(filePath, store);
      });
    },

    async setSigningKey(address: string, signingKey: unknown): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        store.signingKeys[address] = encrypt(serialize(signingKey), key);
        saveStore(filePath, store);
      });
    },

    async getSigningKey(address: string): Promise<unknown | null> {
      const store = loadStore(filePath);
      const enc   = store.signingKeys[address];
      if (!enc) return null;
      try {
        return deserialize(decrypt(enc, key));
      } catch {
        return null;
      }
    },

    async removeSigningKey(address: string): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        delete store.signingKeys[address];
        saveStore(filePath, store);
      });
    },

    async clearSigningKeys(): Promise<void> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        store.signingKeys = {};
        saveStore(filePath, store);
      });
    },

    // ── M8: export / import ────────────────────────────────────────────────────
    // Serialises the on-disk store into a portable encrypted blob.
    // The same apiSecret used for at-rest encryption is used here; a per-export
    // salt ensures the export key is distinct from the storage key even for the
    // same secret.

    async exportPrivateStates(_options?: { password?: string; maxStates?: number }): Promise<PrivateStateExport> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        const salt  = randomBytes(16).toString('hex');
        const exportKey = deriveExportKey(apiSecret, salt);
        const encryptedPayload = encrypt(JSON.stringify(store.states), exportKey);
        return { format: 'midnight-private-state-export', encryptedPayload, salt };
      });
    },

    async importPrivateStates(
      exportData: PrivateStateExport,
      options?: { password?: string; conflictStrategy?: 'skip' | 'overwrite' | 'error'; maxStates?: number },
    ): Promise<ImportPrivateStatesResult> {
      return _storeMutex.runExclusive(() => {
        const exportKey    = deriveExportKey(apiSecret, exportData.salt);
        const imported_states: FileStore['states'] = JSON.parse(decrypt(exportData.encryptedPayload, exportKey));
        const store        = loadStore(filePath);
        const strategy     = options?.conflictStrategy ?? 'skip';
        let imported = 0;
        let skipped  = 0;

        for (const [addr, stateMap] of Object.entries(imported_states)) {
          for (const [stateId, enc] of Object.entries(stateMap)) {
            const exists = !!(store.states[addr]?.[stateId]);
            if (exists && strategy === 'skip')  { skipped++;  continue; }
            if (exists && strategy === 'error') { throw new Error(`Conflict: ${addr}/${stateId}`); }
            if (!store.states[addr]) store.states[addr] = {};
            store.states[addr][stateId] = enc;
            imported++;
          }
        }
        saveStore(filePath, store);
        return { imported, skipped };
      });
    },

    async exportSigningKeys(_options?: { password?: string }): Promise<SigningKeyExport> {
      return _storeMutex.runExclusive(() => {
        const store = loadStore(filePath);
        const salt  = randomBytes(16).toString('hex');
        const exportKey = deriveExportKey(apiSecret, salt);
        const encryptedPayload = encrypt(JSON.stringify(store.signingKeys), exportKey);
        return { format: 'midnight-signing-key-export', encryptedPayload, salt };
      });
    },

    async importSigningKeys(
      exportData: SigningKeyExport,
      options?: { password?: string; conflictStrategy?: 'skip' | 'overwrite' | 'error' },
    ): Promise<ImportSigningKeysResult> {
      return _storeMutex.runExclusive(() => {
        const exportKey    = deriveExportKey(apiSecret, exportData.salt);
        const imported_keys: FileStore['signingKeys'] = JSON.parse(decrypt(exportData.encryptedPayload, exportKey));
        const store        = loadStore(filePath);
        const strategy     = options?.conflictStrategy ?? 'skip';
        let imported = 0;
        let skipped  = 0;

        for (const [addr, enc] of Object.entries(imported_keys)) {
          const exists = addr in store.signingKeys;
          if (exists && strategy === 'skip')  { skipped++;  continue; }
          if (exists && strategy === 'error') { throw new Error(`Conflict: signing key ${addr}`); }
          store.signingKeys[addr] = enc;
          imported++;
        }
        saveStore(filePath, store);
        return { imported, skipped };
      });
    },
  };
}
