/**
 * In-memory PrivateStateProvider — drop-in replacement for levelPrivateStateProvider.
 *
 * Avoids the classic-level native addon entirely. Suitable for a stateless sidecar
 * that rebuilds private state from the HTTP request body on every call.
 *
 * Implements the full PrivateStateProvider<PSI, PS> interface from
 * @midnight-ntwrk/midnight-js-types@4.0.4.
 */

export interface PrivateStateExport {
  readonly format: 'midnight-private-state-export';
  readonly encryptedPayload: string;
  readonly salt: string;
}

export interface SigningKeyExport {
  readonly format: 'midnight-signing-key-export';
  readonly encryptedPayload: string;
  readonly salt: string;
}

export interface ImportPrivateStatesResult {
  imported: number;
  skipped: number;
}

export interface ImportSigningKeysResult {
  imported: number;
  skipped: number;
}

export interface InMemoryPrivateStateProvider<PSI extends string = string, PS = unknown> {
  setContractAddress(address: string): void;
  set(privateStateId: PSI, state: PS): Promise<void>;
  get(privateStateId: PSI): Promise<PS | null>;
  remove(privateStateId: PSI): Promise<void>;
  clear(): Promise<void>;
  setSigningKey(address: string, signingKey: unknown): Promise<void>;
  getSigningKey(address: string): Promise<unknown | null>;
  removeSigningKey(address: string): Promise<void>;
  clearSigningKeys(): Promise<void>;
  exportPrivateStates(options?: { password?: string; maxStates?: number }): Promise<PrivateStateExport>;
  importPrivateStates(exportData: PrivateStateExport, options?: { password?: string; conflictStrategy?: 'skip' | 'overwrite' | 'error'; maxStates?: number }): Promise<ImportPrivateStatesResult>;
  exportSigningKeys(options?: { password?: string }): Promise<SigningKeyExport>;
  importSigningKeys(exportData: SigningKeyExport, options?: { password?: string; conflictStrategy?: 'skip' | 'overwrite' | 'error' }): Promise<ImportSigningKeysResult>;
}

export function inMemoryPrivateStateProvider<PSI extends string = string, PS = unknown>(): InMemoryPrivateStateProvider<PSI, PS> {
  const states     = new Map<PSI, PS>();
  const signingKeys = new Map<string, unknown>();

  return {
    setContractAddress(_address: string): void {
      // no-op — contract address not needed for in-memory storage
    },

    async set(id: PSI, state: PS): Promise<void> {
      states.set(id, state);
    },

    async get(id: PSI): Promise<PS | null> {
      return states.get(id) ?? null;
    },

    async remove(id: PSI): Promise<void> {
      states.delete(id);
    },

    async clear(): Promise<void> {
      states.clear();
    },

    async setSigningKey(address: string, signingKey: unknown): Promise<void> {
      signingKeys.set(address, signingKey);
    },

    async getSigningKey(address: string): Promise<unknown | null> {
      return signingKeys.get(address) ?? null;
    },

    async removeSigningKey(address: string): Promise<void> {
      signingKeys.delete(address);
    },

    async clearSigningKeys(): Promise<void> {
      signingKeys.clear();
    },

    async exportPrivateStates(_options?: { password?: string; maxStates?: number }): Promise<PrivateStateExport> {
      return { format: 'midnight-private-state-export', encryptedPayload: '', salt: '' };
    },

    async importPrivateStates(_exportData: PrivateStateExport, _options?: unknown): Promise<ImportPrivateStatesResult> {
      return { imported: 0, skipped: 0 };
    },

    async exportSigningKeys(_options?: { password?: string }): Promise<SigningKeyExport> {
      return { format: 'midnight-signing-key-export', encryptedPayload: '', salt: '' };
    },

    async importSigningKeys(_exportData: SigningKeyExport, _options?: unknown): Promise<ImportSigningKeysResult> {
      return { imported: 0, skipped: 0 };
    },
  };
}
