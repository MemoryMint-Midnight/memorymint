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
import { filePrivateStateProvider } from './filePrivateStateProvider.js';
import { TxTimeoutError, classifyError } from './errors.js';
import { SERVICE } from '../config.js';
import { logger } from '../lib/logger.js';

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

// ── Timeout helpers ───────────────────────────────────────────────────────────

const TX_DEPLOY_TIMEOUT_MS  = 15 * 60 * 1000; // 15 min — deploy + mintMemory (two proof rounds)
const TX_CIRCUIT_TIMEOUT_MS =  8 * 60 * 1000; // 8 min  — single circuit call

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TxTimeoutError(`"${label}" timed out after ${ms / 60_000} min`)),
        ms,
      ),
    ),
  ]);
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
  try {
    return await withTimeout(_deployMemoryToken(input), TX_DEPLOY_TIMEOUT_MS, 'deployMemoryToken');
  } catch (err) {
    throw classifyError(err, 'mintMemory');
  }
}

async function _deployMemoryToken(input: MintMemoryInput): Promise<string> {
  const providers            = await getProviders();
  const privateStateProvider = filePrivateStateProvider(SERVICE.privateStatePath, SERVICE.apiSecret);

  const ownerSecretKey = deriveUserSecretKey(input.userMnemonic);

  const initialPrivateState: MemoryPrivateState = {
    secretKey:       ownerSecretKey,
    contentHash:     input.contentHash,
    timestamp:       input.timestamp,
    geoHash:         input.geoHash,
    tagCount:        input.tagCount,
    cardanoAssetId:  input.cardanoAssetId,
    newOwnerCommit:  new Uint8Array(32),
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
  logger.info({ contractAddress }, 'deployContract OK');

  // The RPC WebSocket can time out during the ~2-4 min proof generation.
  // Re-sync the wallet before calling mintMemory to ensure the connection is live.
  // Independent 2-min timeout so a stall here surfaces quickly rather than
  // consuming the remaining deploy timeout budget.
  logger.info('Re-syncing wallet before mintMemory...');
  await withTimeout(
    Rx.firstValueFrom(
      providers.wallet.state().pipe(
        Rx.filter((s: any) => s.isSynced),
      ),
    ),
    2 * 60 * 1000,
    're-sync after deploy',
  );
  logger.info('Wallet synced, calling mintMemory...');

  // deployContract only puts the bytecode on-chain — call mintMemory to initialise ledger state
  await (deployed.callTx as any).mintMemory();
  logger.info('mintMemory OK');

  return contractAddress;
}

export async function callCircuit(
  contractAddress:     string,
  circuit:             string,
  userMnemonic:        string,
  privateStateUpdates: Partial<MemoryPrivateState>,
  circuitArgs:         unknown[] = [],
): Promise<string> {
  try {
    return await withTimeout(
      _callCircuit(contractAddress, circuit, userMnemonic, privateStateUpdates, circuitArgs),
      TX_CIRCUIT_TIMEOUT_MS,
      circuit,
    );
  } catch (err) {
    throw classifyError(err, circuit);
  }
}

async function _callCircuit(
  contractAddress:     string,
  circuit:             string,
  userMnemonic:        string,
  privateStateUpdates: Partial<MemoryPrivateState>,
  circuitArgs:         unknown[],
): Promise<string> {
  const providers            = await getProviders();
  const privateStateProvider = filePrivateStateProvider(SERVICE.privateStatePath, SERVICE.apiSecret);

  const secretKey = deriveUserSecretKey(userMnemonic);

  const basePrivateState: MemoryPrivateState = {
    secretKey,
    contentHash:    new Uint8Array(32),
    timestamp:      0n,
    geoHash:        new Uint8Array(32),
    tagCount:       0n,
    cardanoAssetId: new Uint8Array(32),
    newOwnerCommit: new Uint8Array(32),
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
