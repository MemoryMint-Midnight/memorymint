/**
 * memory_token contract wrapper — real implementation
 *
 * Uses the generated managed/ API from compactc + the midnight-js SDK
 * to deploy contracts and call circuits.
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js/types';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import * as Rx from 'rxjs';
import {
  getProviders,
  ZK_CONFIG_PATH,
  MEMORY_PRIVATE_STATE_ID,
  deriveUserSecretKey,
  type MemoryPrivateState,
} from './provider.js';
import { inMemoryPrivateStateProvider } from './inMemoryPrivateStateProvider.js';

// ── Lazy-load generated contract via ESM import() to share the module cache ──
// IMPORTANT: Do NOT use createRequire/require() here — tsx's CJS hook transforms
// ESM imports inside require()'d files to require() calls, creating a second
// instance of onchain-runtime-v3 WASM. Using dynamic import() forces the
// managed contract through the ESM loader, sharing the same WASM instance.

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANAGED_PATH = pathToFileURL(
  join(__dirname, '../../../contracts/managed/contract/index.js')
).href;

let _Contract: any = null;

async function getContract(): Promise<any> {
  if (!_Contract) {
    const managed = await import(MANAGED_PATH);
    _Contract = managed.Contract;
  }
  return _Contract;
}

// ── Witnesses — bridge HTTP request data → Compact witness functions ──────────

function makeWitnesses(privateState: MemoryPrivateState) {
  return {
    localSecretKey:          ({ privateState: ps }: any) => [ps, ps.secretKey],
    secretContentHash:       ({ privateState: ps }: any) => [ps, ps.contentHash],
    secretTimestamp:         ({ privateState: ps }: any) => [ps, ps.timestamp],
    secretGeoHash:           ({ privateState: ps }: any) => [ps, ps.geoHash],
    secretTagCount:          ({ privateState: ps }: any) => [ps, ps.tagCount],
    secretCardanoAssetId:    ({ privateState: ps }: any) => [ps, ps.cardanoAssetId],
    secretNewOwnerCommitment:({ privateState: ps }: any) => [ps, ps.newOwnerCommit],
    secretCutoffTimestamp:   ({ privateState: ps }: any) => [ps, ps.cutoffTimestamp],
  };
}

// ── Compiled contract ─────────────────────────────────────────────────────────

async function makeCompiledContract(privateState: MemoryPrivateState) {
  const Contract = await getContract();
  const witnesses = makeWitnesses(privateState);

  return CompiledContract.make('memory_token', Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MintMemoryInput {
  userMnemonic:   string;       // user's BIP-39 mnemonic — sk derived internally
  contentHash:    Uint8Array;
  timestamp:      bigint;
  geoHash:        Uint8Array;
  tagCount:       bigint;
  cardanoAssetId: Uint8Array;
}

export async function deployMemoryToken(input: MintMemoryInput): Promise<string> {
  const providers = await getProviders();
  const privateStateProvider = inMemoryPrivateStateProvider();

  const ownerSecretKey = deriveUserSecretKey(input.userMnemonic);

  const initialPrivateState: MemoryPrivateState = {
    secretKey:       ownerSecretKey,
    contentHash:     input.contentHash,
    timestamp:       input.timestamp,
    geoHash:         input.geoHash,
    tagCount:        input.tagCount,
    cardanoAssetId:  input.cardanoAssetId,
    newOwnerCommit:  new Uint8Array(32),
    cutoffTimestamp: 0n,
  };

  const compiled = await makeCompiledContract(initialPrivateState);

  const deployed = await deployContract(
    {
      privateStateProvider,
      publicDataProvider:   providers.publicDataProvider,
      zkConfigProvider:     providers.zkConfigProvider,
      proofProvider:        providers.proofProvider,
      walletProvider:       providers.walletProvider,
      midnightProvider:     providers.walletProvider,
    },
    {
      compiledContract:    compiled,
      privateStateId:      MEMORY_PRIVATE_STATE_ID,
      initialPrivateState,
    },
  );

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log('[contract] deployContract OK, address:', contractAddress);

  // The RPC WebSocket can time out during the ~2-4 min proof generation.
  // Re-sync the wallet before calling mintMemory to ensure the connection is live.
  console.log('[contract] Re-syncing wallet before mintMemory...');
  await Rx.firstValueFrom(
    providers.wallet.state().pipe(
      Rx.filter((s: any) => s.isSynced),
    ),
  );
  console.log('[contract] Wallet synced, calling mintMemory...');

  // deployContract only puts the bytecode on-chain — call mintMemory to initialise ledger state
  await (deployed.callTx as any).mintMemory();
  console.log('[contract] mintMemory OK');

  return contractAddress;
}

export async function callCircuit(
  contractAddress:     string,
  circuit:             string,
  userMnemonic:        string,
  privateStateUpdates: Partial<MemoryPrivateState>,
  circuitArgs:         unknown[] = [],
): Promise<string> {
  const providers = await getProviders();
  const privateStateProvider = inMemoryPrivateStateProvider();

  const secretKey = deriveUserSecretKey(userMnemonic);

  const basePrivateState: MemoryPrivateState = {
    secretKey,
    contentHash:     new Uint8Array(32),
    timestamp:       0n,
    geoHash:         new Uint8Array(32),
    tagCount:        0n,
    cardanoAssetId:  new Uint8Array(32),
    newOwnerCommit:  new Uint8Array(32),
    cutoffTimestamp: 0n,
    ...privateStateUpdates,
  };

  const compiled = await makeCompiledContract(basePrivateState);

  const found = await findDeployedContract(
    {
      privateStateProvider,
      publicDataProvider:   providers.publicDataProvider,
      zkConfigProvider:     providers.zkConfigProvider,
      proofProvider:        providers.proofProvider,
      walletProvider:       providers.walletProvider,
      midnightProvider:     providers.walletProvider,
    },
    {
      contractAddress,
      compiledContract:    compiled,
      privateStateId:      MEMORY_PRIVATE_STATE_ID,
      initialPrivateState: basePrivateState,
    },
  );

  const result: FinalizedTxData = await (found.callTx as any)[circuit](...circuitArgs);
  return result.public.txId;
}
