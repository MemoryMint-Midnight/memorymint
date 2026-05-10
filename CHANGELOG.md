# Changelog

All notable changes to MemoryMint will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Security Audit Summary — 2026-05-10

A full security and production-readiness audit was completed on 2026-05-09 covering the WordPress plugin, Midnight sidecar, and Next.js frontend. **25 findings** were identified across four severity tiers and resolved across versions v1.1.23–v1.1.28.

### Scope

| Layer | What was audited |
|---|---|
| WordPress plugin | Auth flows, encryption, Cardano mint pipeline, Midnight API endpoints, admin UI |
| Midnight sidecar | Key handling, circuit wiring, provider lifecycle, network config, logging |
| Next.js frontend | Client-side secrets, wallet auth, mint UX flow, async polling |
| Cross-cutting | Atomicity guarantees, rate limiting, error propagation, async job safety |

### Finding Summary

| ID | Severity | Title | Fixed in |
|---|---|---|---|
| C1 | Critical | wallet_connect had no signature verification — any address string could auth as any user | v1.1.23 |
| C2 | Critical | Key storage used AES-256-CBC with raw SHA-256 KDF — no authentication tag, no salt | v1.1.23 |
| C3 | Critical | proveContentAuthentic passed wrong witness key + hex string instead of Uint8Array | v1.1.23 / v1.1.27 |
| C4 | Critical | NEXT_PUBLIC_ANVIL_API_KEY baked into browser bundle via dead code | v1.1.23 |
| H1 | High | Transfer sent recipient's raw mnemonic to sidecar over HTTP | v1.1.24 |
| H2 | High | Client-side AES-GCM encryption KDF was raw SHA-256 (no salt, no stretching) | v1.1.23 |
| H3 | High | Private keepsake real file_url written to public CIP-25 on-chain metadata | v1.1.24 |
| H4 | High | Midnight indexer defaulted to deprecated API v3 | v1.1.24 |
| H5 | High | Re-sync after contract deploy had no inner timeout — could hang indefinitely | v1.1.24 |
| H6 | High | No DUST balance monitoring — operator blind to sidecar running dry | v1.1.24 |
| H7 | High | No Cardano↔Midnight atomicity — failed Midnight mints silently abandoned | v1.1.24 |
| H8 | High | Midnight mint endpoint had no rate limiting | v1.1.24 |
| M1 | Medium | get_seed_phrase required only a JWT — no step-up auth before returning mnemonic | v1.1.25 |
| M2 | Medium | filePrivateStateProvider had no write mutex — concurrent writes could corrupt state | v1.1.25 |
| M3 | Medium | networkId hardcoded to 'preprod' — mainnet deploy would silently target wrong network | v1.1.25 |
| M4 | Medium | Mnemonic validation duplicated across 4 routes with inconsistent regex | v1.1.25 |
| M5 | Medium | wallet_connect didn't verify address wasn't already owned by a different account | v1.1.25 |
| M6 | Medium | Dead inMemoryPrivateStateProvider left in BuiltProviders (would use volatile state on restart) | v1.1.25 |
| M7 | Medium | Tag circuit input validation absent (already resolved by prior circuit refactor) | — |
| M8 | Medium | filePrivateStateProvider export/import were unimplemented stubs | v1.1.25 |
| L1 | Low | CORS origin was any value of NEXT_PUBLIC_URL env var — no validation | v1.1.26 |
| L2 | Low | Policy wallet had no time-lock option for mainnet — permanent minting policy | v1.1.26 |
| L3 | Low | No idempotency key on Cardano mint — duplicate submission possible on network drop | v1.1.26 |
| L4 | Low | CIP-25 label 721 used instead of CIP-68 (no migration path for mainnet) | v1.1.26 |
| L5 | Low | Midnight sidecar used console.log — no structured logs, no level control | v1.1.26 |

### Additional Production Bugs (found during audit implementation)

| ID | Description | Fixed in |
|---|---|---|
| Bug 1 | Custodial mints always failed — ADA balance check ran against intentionally-empty custodial wallet; `fee_payer_address` never set so Anvil tried to fund from it | v1.1.27 |
| Bug 2 | All Midnight operations 504'd in production — sidecar calls (8–15 min) blocked synchronously inside PHP request handler; Nginx's `fastcgi_read_timeout` (60s) killed every response | v1.1.27 |
| Bug 3 | proveContentAuthentic final key name wrong — `secretContentHash` is not a field in `MemoryPrivateState`; corrected to `contentHash` with `Buffer.from(hex, 'hex')` | v1.1.27 |

### Frontend / Flow Inefficiencies (resolved post-audit)

| ID | Description | Fixed in |
|---|---|---|
| I1 | prove/transfer/revoke pages expected synchronous 200 — returned 202 async, pages never resolved | v1.1.28 |
| I2 | Wallet connected twice per file in mint loop — N files triggered 2N wallet popups | v1.1.28 |
| I3 | Batch pricing logic (`typeCounts` + fee reduce) duplicated verbatim in 3 places | v1.1.28 |
| I4 | `pollTxStatus` slept 5s before first attempt — Anvil confirms nearly instantly | v1.1.28 |
| I5 | `POST /mint/midnight/{id}` never called from mint page — private keepsakes never registered on Midnight | v1.1.28 |

### VPS Production Requirement (Bug 2)

To prevent Midnight job timeouts in production, add to `wp-config.php`:
```php
define('DISABLE_WP_CRON', true);
```
And add to system crontab:
```
* * * * * wp cron event run --due-now --path=/var/www/html
```
This ensures Midnight jobs (`memorymint_run_midn_job`) execute in a CLI process outside Nginx's `fastcgi_read_timeout`.

---

## [1.1.28] - 2026-05-10

### Improvements

- **Frontend: Mint page calls `POST /mint/midnight/{id}` after Cardano confirms** (`frontend/app/mint/page.tsx`)
  - Private keepsakes were never registered on Midnight from the mint flow — the endpoint existed but was never called
  - After all Cardano transactions confirm, the mint page now fires `POST /memorymint/v1/mint/midnight/{keepsake_id}` for each private keepsake, handles the 202 async response, and shows a "Midnight privacy registration queued" notice with a link to the gallery for status tracking
  - Calls are fired in parallel with `Promise.allSettled` so a Midnight failure does not block the Cardano mint result from displaying

- **Frontend: Deduplicated batch pricing logic** (`frontend/app/mint/page.tsx`)
  - The batch fee computation (`typeCounts` + `totalUsd` + `totalAda`) was copied verbatim in 3 places: the balance pre-check, the inline fee widget, and the confirmation modal
  - Extracted into a module-level `computeBatchTotals(files, priceInfo)` helper used at all 3 sites — any future pricing change updates automatically everywhere

- **Frontend: Wallet connected once for entire mint batch** (`frontend/app/mint/page.tsx`)
  - `connectWallet()` was called twice per file (once for encryption, once for signing) — N files triggered 2N wallet popups
  - Wallet is now connected once before the loop; the same `walletApi` and `addressHex` are reused across all encrypt + sign operations

- **Frontend: Batch tx polling parallelised** (`frontend/app/mint/page.tsx`)
  - Each submitted transaction was polled sequentially, adding ~5 s wait per file
  - All N tx hashes are now polled simultaneously with `Promise.all` so the batch shares one confirmation window

- **Frontend: Midnight pages handle 202 async response with job polling** (`frontend/app/midnight/prove/page.tsx`, `transfer/page.tsx`, `revoke/page.tsx`, `lib/useMidnightJob.ts`)
  - prove, transfer, revoke pages previously expected a synchronous success response; they now detect 202 + `queued`, store the `job_id`, and use the new `useMidnightJob` hook to poll `GET /midnight/job/{id}` every 8 s, updating UI automatically on completion or failure

- **Frontend: `pollTxStatus` first check at 2 s instead of 5 s** (`frontend/app/mint/page.tsx`)
  - Flat 5 s sleep before every poll attempt wasted 3 s on the first check; Anvil writes `confirmed` nearly instantly after submission
  - First attempt now checks at 2 s; subsequent attempts use the existing 5 s interval

---

## [1.1.27] - 2026-05-10

### Bug Fixes

- **Bug 1 — Custodial mints always fail at build step** (`class-mint-api.php` `build_transaction`)
  - The ADA balance check was applied to custodial (email) users whose wallets intentionally hold no ADA, so every custodial mint was rejected with a "not enough ADA" error before even calling Anvil
  - Fixed: balance check now only runs for self-custody (browser wallet) users (`!$is_custodial_user`)
  - Fixed: `fee_payer_address = $policy_wallet->payment_address` is now added to `$tx_params` for custodial users so `AnvilService::build_mint_transaction()` correctly uses the policy wallet UTXOs to fund the transaction and routes the NFT explicitly to the custodial user's address via a 2 ADA output

- **Bug 2 — All Midnight operations 504 in production** (`class-midnight-api.php`, `class-mint-api.php`, new `includes/cron/class-midnight-jobs.php`)
  - Sidecar calls (prove, transfer, revoke, mint) take 8–15 min but were invoked synchronously inside the PHP request handler; Nginx's `fastcgi_read_timeout` (default 60 s) kills the response before the sidecar finishes, returning 504 to the user
  - Fixed: new `MidnightJobs` async job queue (`class-midnight-jobs.php`) — stores job metadata in `wp_options`, schedules a WP Cron single event (`memorymint_run_midn_job`), and returns control immediately
  - `prove`, `transfer`, `revoke` in `class-midnight-api.php` now queue a job and return HTTP 202 `{ queued: true, job_id }`; mnemonic availability is still validated synchronously (fail fast)
  - `mint_on_midnight` in `class-mint-api.php` now queues a job and returns HTTP 202 `{ queued: true, job_id }`
  - New polling endpoints added to `class-midnight-api.php`:
    - `GET /memorymint/v1/midnight/{id}/status` — returns `midnight_status` + `midnight_address` from the keepsake row (for Midnight mint polling)
    - `GET /memorymint/v1/midnight/job/{job_id}` — returns full job status + result for prove/transfer/revoke (owner-only)
  - `memorymint_run_midn_job` hook registered in `class-memory-mint.php`; cleared on deactivation in `class-deactivator.php`
  - **VPS production requirement**: add `define('DISABLE_WP_CRON', true)` to wp-config.php and a real system cron (`* * * * * wp cron event run --due-now --path=/var/www/html`) so jobs run in a CLI process without any Nginx timeout

- **Bug 3 — proveContentAuthentic private witness uses wrong key and type** (`midnight/service/src/routes/prove.ts`)
  - `privateStateUpdates` was set to `{ secretContentHash: body.contentHash }` — wrong key (`secretContentHash` vs `contentHash` in `MemoryPrivateState`) and wrong type (hex string vs `Uint8Array`)
  - The `makeWitnesses.secretContentHash` function reads `ps.contentHash` (a `Uint8Array`); passing a hex string under a non-existent key meant the witness always read zeros from the base private state
  - Fixed: `{ contentHash: Buffer.from(body.contentHash, 'hex') }` — correct key, correct type

---

## [1.1.26] - 2026-05-10

### Security / Reliability (Low fixes — L1 through L5)

- **L1 — CORS validated against explicit allowlist** (`index.ts`, `.env.example`)
  - Replaced open `origin: process.env.NEXT_PUBLIC_URL` with a validated `allowedOrigins` array; new `CORS_ALLOWED_ORIGINS` env var accepts a comma-separated list for multi-domain setups; unrecognised origins are rejected with a logged warning
- **L2 — Policy wallet time-lock for mainnet** (`class-admin-page.php`, `policy-wallet.php`)
  - New `before_slot` field shown on the Generate Wallet form when network is `mainnet`; when provided, builds a time-locked `{"type":"all","scripts":[sig,before]}` native script with correct CBOR encoding (`blake2b-224` → `policy_id`); simple sig script used on preprod or when omitted
  - Admin UI shows current slot estimate and a 5-year recommendation; wallets table warns when the active mainnet wallet has no time-lock
- **L3 — Cardano transaction idempotency key** (`class-mint-api.php`)
  - `sign_and_submit` and `custodial_sign` now check for `memorymint_txhash_{keepsake_id}` transient on entry — if set, Anvil already confirmed the submission and the cached `tx_hash` is returned without re-signing or re-submitting
  - The transient is set immediately after `submit_transaction()` returns success (5-min TTL) and deleted after the DB update completes; eliminates double-spend risk when network drops after Anvil succeeds but before `mint_status = 'minted'` is written
- **L4 — CIP-25 → CIP-68 migration reminder** (`class-admin-page.php`, `class-anvil-service.php`)
  - Admin notice shown on all Memory Mint admin pages when network is `mainnet`, reminding to migrate from label 721 (CIP-25) to CIP-68 before launch
  - `TODO (L4)` comment added in `class-anvil-service.php` at the label 721 metadata key
- **L5 — Structured logging via pino** (`package.json`, new `lib/logger.ts`, `index.ts`, `errorHandler.ts`, `contract.ts`, `provider.ts`, `filePrivateStateProvider.ts`)
  - Added `pino@^9.6.0`; created `service/src/lib/logger.ts` exporting a configured pino logger (respects `LOG_LEVEL` env var, default `info`)
  - Replaced all `console.log/error/warn` calls across the sidecar with structured `logger.info/error/warn` calls using pino's object-first convention; sync progress now logged as structured fields (connected, shielded %, etc.)
  - `LOG_LEVEL` documented in `.env.example`

---

## [1.1.25] - 2026-05-10

### Security (Medium fixes — M1 through M8)

- **M1 — get_seed_phrase: OTP re-auth gate** (`class-auth-api.php`)
  - New `POST memorymint/v1/auth/seed-phrase-otp` sends a fresh 6-digit OTP to the user's email (reuses existing `send_otp` mechanism)
  - `GET memorymint/v1/auth/seed-phrase` now requires `?otp=` query param; verifies against the stored hash, checks expiry, and single-use-consumes it before returning the mnemonic
- **M2 — filePrivateStateProvider: write mutex** (`filePrivateStateProvider.ts`, `package.json`)
  - Added `async-mutex@^0.5.0`; module-level `_storeMutex` wraps all read-compute-write operations (`set`, `remove`, `clear`, `setSigningKey`, `removeSigningKey`, `clearSigningKeys`); read-only `get`/`getSigningKey` are unprotected (atomic rename guarantees file validity)
- **M3 — networkId driven by env var** (`index.ts`, `.env.example`)
  - `setNetworkId('preprod')` replaced with `setNetworkId((process.env.MIDNIGHT_NETWORK_ID ?? 'preprod') as NetworkId)`
  - `MIDNIGHT_NETWORK_ID=preprod` documented in `.env.example`; also updated example indexer URLs to v4
- **M4 — Shared mnemonic Zod schema** (new `lib/schemas.ts`, updated `prove.ts`, `tag.ts`, `transfer.ts`, `revoke.ts`)
  - Extracted `mnemonicSchema` (`/^([a-z]+)( [a-z]+){11,23}$/`) into `service/src/lib/schemas.ts`; all four mnemonic-accepting routes now import and use it
- **M5 — wallet_connect: address ownership check** (`class-auth-api.php`)
  - After CIP-8 sig verification, checks if `wallet_address` already belongs to a different WP user; returns 403 if an authenticated session tries to claim another account's address
- **M6 — Remove dead inMemoryPrivateStateProvider** (`provider.ts`)
  - Removed `privateStateProvider: InMemoryPrivateStateProvider` from `BuiltProviders` interface and `buildProviders` return; removed the import; `filePrivateStateProvider` is always created locally in contract.ts
- **M7 — tagCount Uint<8> validation** — already resolved; `updateTag()` Compact circuit takes no arguments, tagCount field was previously removed from the route body
- **M8 — filePrivateStateProvider export/import implemented** (`filePrivateStateProvider.ts`)
  - `exportPrivateStates()` / `exportSigningKeys()`: serialise the relevant store slice to JSON, encrypt with AES-256-GCM keyed from `apiSecret + per-export random salt`, return `PrivateStateExport`
  - `importPrivateStates()` / `importSigningKeys()`: re-derive key from export's `salt` + `apiSecret`, decrypt, merge with `skip`/`overwrite`/`error` conflict strategies; all operations hold the write mutex

---

## [1.1.24] - 2026-05-10

### Security (High fixes — H1 through H8)

- **H1 — Transfer: new owner's mnemonic no longer sent to sidecar** (`class-midnight-service.php`, `transfer.ts`, `provider.ts`)
  - PHP derives the new owner's 32-byte Midnight sk locally (PBKDF2-SHA512 BIP-39 seed → HMAC-SHA256 domain key) and sends only `newOwnerSecretKey` (64-char hex)
  - `transfer.ts` schema changed from `newOwnerMnemonic` → `newOwnerSecretKey`; sidecar calls new `commitmentFromSecretKey(sk)` to compute the on-chain commitment — raw mnemonic never leaves WordPress
  - New `commitmentFromSecretKey(sk: Uint8Array)` export added to `provider.ts`; `computeOwnerCommitment` now delegates to it
- **H2 — KDF weak (already fixed as part of C2)** — AES-256-GCM + PBKDF2 in v1.1.23
- **H3 — Private keepsake file_url hidden from CIP-25 metadata** (`class-mint-api.php`)
  - `keepsake_type = 'private'` now writes `thumbnail_url` (placeholder) as the CIP-25 `image` field, never the real `file_url`
- **H4 — Midnight indexer upgraded to API v4** (`config.ts`)
  - Default `MIDNIGHT.indexer` and `MIDNIGHT.indexerWS` changed from `/api/v3/graphql` → `/api/v4/graphql`
- **H5 — Re-sync after deploy wrapped in 2-min timeout** (`contract.ts`)
  - `_reSyncWallet()` after `deployContract()` now wrapped in `withTimeout(2 * 60 * 1000, 're-sync after deploy')` so a stall surfaces quickly
- **H6 — DUST balance added to health endpoint** (`health.ts`)
  - `GET /health` now reports `dustBalance` (string, lovelace) and `dustWarning` (non-null if below 1T DUST threshold)
- **H7 — Cardano↔Midnight reconciliation cron** (new `cron/class-midnight-reconciliation.php`, `class-memory-mint.php`)
  - New WP Cron job runs every 20 minutes, queries `midnight_status = 'failed'` keepsakes, and retries Midnight mint with exponential backoff (20m → 1h → 4h → 24h → 48h); after 5 failures sets `midnight_status = 'failed_permanent'`
  - Self-custody users (mnemonic deleted) are skipped — they complete via DApp Connector
  - Retry state stored in `wp_options` per keepsake (`memorymint_mid_retry_{id}`)
- **H8 — Rate limiting on Midnight mint endpoint** (`mint.ts`, `package.json`)
  - Added `express-rate-limit@^7.5.0`; 1 request/30s per IP on `POST /api/v1/midnight/mint`

---

## [1.1.23] - 2026-05-10

### Security (Critical fixes — C1 through C4)

- **C1 — wallet_connect: CIP-8 challenge-response auth** (`class-auth-api.php`, `class-cose-verifier.php`, `LoginModal.tsx`)
  - New `GET memorymint/v1/auth/wallet-nonce?address=<hex>` endpoint issues a 16-byte random nonce (WP transient, 2-min TTL, single-use)
  - `POST wallet-connect` now requires `raw_address`, `signature` (COSE_Sign1 hex), and `key` (COSE_Key hex)
  - New `CoseVerifier` PHP helper: minimal CBOR decoder + COSE_Sign1 parser; verifies Ed25519 signature via sodium extension; checks address in protected header and nonce payload before issuing any auth token
  - Frontend (`LoginModal.tsx`): fetches nonce, calls `wallet.signData(rawAddress, nonce)`, includes result in wallet-connect request
  - Eliminates the auth bypass where any address string could be used to authenticate as any user

- **C2 — AES-256-GCM + PBKDF2 for all key storage** (`class-encryption.php`)
  - Cipher changed from `aes-256-cbc` to `aes-256-gcm`; all new ciphertext carries a 16-byte GCM auth tag (tamper-evident)
  - KDF changed from raw `hash('sha256', ...)` to `hash_pbkdf2('sha256', ikm, $salt, 100_000, 32, true)` with a per-record 16-byte random salt
  - New format: `v2:<base64(salt+iv+tag+ciphertext)>`; old v1 CBC format still decryptable for backward-compat migration

- **C3 — proveContentAuthentic: correct private witness** (`midnight/service/src/routes/prove.ts`)
  - `content_authentic` ProveBody schema now requires `contentHash` (64-char hex SHA-256)
  - `callCircuit` receives `{ secretContentHash: contentHash }` as `privateStateUpdates` instead of the previous empty `{}`, so the `secretContentHash()` witness returns the correct value and the proof can succeed
  - Note: contract must still be recompiled in WSL2 (`npm run compile` in `midnight/`) to generate the missing `proveContentAuthentic` prover/verifier key pair

- **C4 — NEXT_PUBLIC_ANVIL_API_KEY removed from browser bundle** (`frontend/lib/cardano.ts`)
  - Deleted dead `mintMemoryNFT`, `getUserMemories`, and `verifyTransaction` functions (mint goes through WordPress API)
  - Removed `Memory` interface (only used by deleted functions)
  - Removed `const ANVIL_API_KEY = process.env.NEXT_PUBLIC_ANVIL_API_KEY` — key no longer baked into client JS

---

## [1.1.22] - 2026-04-19

### Added
- `src/midnight/errors.ts` — typed error classes: `TxTimeoutError` (with optional `txHash`), `ProofError` (with `circuit` name), `NetworkError`, `WalletError`; `classifyError()` promotes raw SDK errors to the correct type by inspecting message content
- `src/midnight/filePrivateStateProvider.ts` — AES-256-GCM encrypted, file-backed private state provider; survives sidecar restarts during the 2-4 min proof generation window; custom JSON serializer handles `bigint` and `Uint8Array`; atomic writes via rename-with-fallback; key derived from `MIDNIGHT_API_SECRET`
- `src/middleware/errorHandler.ts` — central Express error handler: `TxTimeoutError` → HTTP 202 (pending + optional txHash), `ProofError` → HTTP 422, `NetworkError`/`WalletError` → HTTP 503, generic → HTTP 500

### Changed
- `contract.ts` — `deployMemoryToken` wrapped with 15-min timeout; `callCircuit` wrapped with 8-min timeout; both use `withTimeout()` + `classifyError()`; switched from `inMemoryPrivateStateProvider` to `filePrivateStateProvider`
- All route handlers — replaced inline catch blocks with `next(err)`; error handler owns HTTP status mapping
- `config.ts` — added `privateStatePath` (env var `PRIVATE_STATE_PATH`, default `./midnight-private-state.json`)
- `index.ts` — `errorHandler` registered as final middleware
- `.env.example` — added `PRIVATE_STATE_PATH` with recommended VPS path (`/data/memorymint/private-state.json`)
- `.gitignore` — added patterns to exclude `midnight-private-state.json` and `.tmp` sibling

### Fixed
- Removed dead `secretCutoffTimestamp` witness from `makeWitnesses` — `proveCreatedBefore` takes `cutoffTimestamp` as a public circuit argument, not a witness
- Removed dead `cutoffTimestamp` field from `MemoryPrivateState` interface in `provider.ts`

---

## [1.1.21] - 2026-04-19

### Added
- Wallet-only login gate (#11): `email_connect` returns `{ wallet_only: true }` (HTTP 403) when the email belongs to an account with `auth_method = 'wallet'` (set after seed backup confirmation)
- `LoginModal`: detects `wallet_only` response and shows a dedicated notice panel explaining seed backup is complete, email login is disabled, and offering a direct "Connect Wallet" button

---

## [1.1.20] - 2026-04-19

### Fixed
- `provision_custodial_wallet`: checked `$wallet['success']` which `CardanoWalletPHP::generateWallet()` never returns — silently skipped wallet generation for every email user; now checks `$wallet['mnemonic']` and `$wallet['addresses']` instead

---

## [1.1.19] - 2026-04-19

### Added
- `confirm_backup` now sets `auth_method = 'wallet'` — backed-up accounts switch to wallet-only login (groundwork for #11)
- `SeedPhraseModal` done step: informs user their next login requires a Cardano wallet (Lace, Eternl, Vespr)
- Account page: `SeedPhraseModal` wired directly; "Back Up Now" button opens modal in-page instead of linking to gallery

---

## [1.1.18] - 2026-04-19

### Changed
- `README.md` — version badge 1.1.17; Project Status table updated: encryption ✅, midnight pages ✅, prove/transfer/revoke proxy endpoints ✅
- `FLOWS.md` — added encryption step to Flow 2 (wallet-connect mint path); added Flow 3 (Decrypt a Private Memory); renumbered old flows 3→5, 4→6, 5→7; updated sequence summary table

---

## [1.1.17] - 2026-04-19

### Added
- Browser-side AES-GCM-256 encryption for private keepsakes (wallet users only)
- `lib/crypto.ts` — sha256File, deriveKeyFromSignature (HKDF-SHA256), encryptFile, decryptFileBuffer
- `signDataForKey()` added to `lib/cardano.ts` — CIP-30 signData wrapper for CEK derivation
- CEK derived deterministically: HKDF(CIP-30 signData(address, "memorymint:decrypt:v1:" + contentHash))
- Mint flow: private + wallet users have file encrypted before upload; original content_hash sent to API
- Gallery detail modal: auto-decrypts encrypted private memories using wallet; shows Decrypt / decrypting / error / no-wallet states
- Plugin: `is_encrypted` column added to keepsakes table (schema + v5 migration)
- Plugin: `create_keepsake` accepts client-provided `content_hash` and `is_encrypted` flag
- Plugin: `format_keepsake` returns `is_encrypted` in API responses

---

## [1.1.16] - 2026-04-19

### Changed
- Admin bypass now supports two independent keys: `mmadmin-jinx` (owner) and `mmhelper-pb` (VPS helper)

---

## [1.1.15] - 2026-04-19

### Changed
- Admin bypass cookie extended from 24 hours to 1 year — no need to re-enter the access key daily

---

## [1.1.14] - 2026-04-19

### Added
- Coming-soon page: discreet Admin button at bottom → password form → validates access key and redirects to full site

---

## [1.1.13] - 2026-04-19

### Fixed
- Coming soon gate was still bypassed — `process.env.COMING_SOON` in Next.js Edge Middleware is statically evaluated at build time, so runtime Vercel env vars have no effect; hardcoded `isComingSoon = true` in middleware until launch

---

## [1.1.12] - 2026-04-19

### Fixed
- Coming soon gate was not active on production — `COMING_SOON=true` env var was missing from Vercel; added to project settings and triggered fresh build to enforce gating

### Changed
- `next.config.js` — disabled `X-Powered-By` response header (`poweredByHeader: false`)

---

## [1.1.11] - 2026-04-19

### Added
- `POST memorymint/v1/midnight/{id}/prove` — proxy endpoint: validates ownership, decrypts user mnemonic, calls sidecar `/api/v1/midnight/:addr/prove`; supports all four proof types (ownership, content_authentic, created_before, contains_tag)
- `POST memorymint/v1/midnight/{id}/transfer` — proxy endpoint: looks up recipient by email, fetches both mnemonics, calls sidecar `/api/v1/midnight/:addr/transfer`, then updates keepsake `user_id` in DB to complete ownership transfer
- `POST memorymint/v1/midnight/{id}/revoke` — proxy endpoint: calls sidecar `/api/v1/midnight/:addr/revoke`, then sets `midnight_status = 'revoked'` in DB (irreversible)
- `prove_memory()`, `transfer_memory()`, `revoke_memory()` methods added to `MidnightService`
- `MidnightApi` registered in `MemoryMint::register_api_routes()`

### Changed
- `midnight_status` enum extended with `'revoked'` value in `class-activator.php` schema definition
- DB migration (v4) in `maybe_run_migrations()` — ALTER TABLE adds `'revoked'` to existing installs via `information_schema` check

---

## [1.1.10] - 2026-04-19

### Changed
- `next.config.js` — removed `output: 'export'`, `trailingSlash`, and `images.unoptimized`; Vercel runs Next.js natively so static export is not needed and was causing a missing routes-manifest error

---

## [1.1.9] - 2026-04-19

### Changed
- Deployment: switched from Namecheap SSH/FTP to Vercel — Namecheap blocks external SSH connections from GitHub Actions IPs
- GitHub Actions workflow simplified to build-check only; Vercel handles deployment directly from GitHub on every push to main

---

## [1.1.8] - 2026-04-19

### Changed
- Deploy workflow: switch from SSH key auth to password-based rsync over SSH via sshpass — Namecheap does not honour cPanel-imported SSH keys

---

## [1.1.7] - 2026-04-19

### Changed
- Deploy workflow: replaced FTP with SSH/rsync via `burnett01/rsync-deployments` — Namecheap blocks FTP connections from GitHub Actions IPs; SSH is more reliable and secure

---

## [1.1.6] - 2026-04-19

### Fixed
- GitHub Actions deploy workflow: use `protocol: ftps` on port 21 — Namecheap rejects plain FTP connections

---

## [1.1.5] - 2026-04-19

### Fixed
- Replaced `app/guide/[slug]/page.tsx` (dynamic server route) with `app/guide/post/page.tsx` (static client page using `?slug=` query param); Next.js 15 static export refuses to build dynamic routes when `generateStaticParams` returns `[]`, which happens when the WordPress API is unreachable during CI

---

## [1.1.4] - 2026-04-19

### Fixed
- `lib/wordpress.ts` — replaced `next: { revalidate }` with `cache: 'force-cache'` on all fetch calls; `revalidate` is not supported in `output: 'export'` static builds and caused the `/guide/[slug]` route to fail with a misleading "missing generateStaticParams" error

---

## [1.1.3] - 2026-04-19

### Fixed
- `guide/[slug]` — wrap `generateStaticParams()` in try/catch so CI build succeeds when WordPress API is unreachable during GitHub Actions build

---

## [1.1.2] - 2026-04-19

### Added
- GitHub Actions workflow (`.github/workflows/deploy.yml`) — auto-builds Next.js frontend and FTP-deploys to Namecheap `public_html/` on every push to `main`

---

## [1.1.1] - 2026-04-19

### Added
- `/midnight/prove` page — select ZK proof type (ownership, content authentic, created before, contains tag), generate proof, copy shareable link
- `/midnight/transfer` page — transfer Midnight private record to another MemoryMint account by email
- `/midnight/revoke` page — permanently revoke Midnight private record (type REVOKE to confirm)
- All three Midnight sub-pages show "coming soon" gracefully when sidecar is not yet deployed

### Changed
- Gallery keepsake detail modal: replaced non-functional "Manage" button with Prove / Transfer / Revoke action buttons linking to the new sub-pages; shows live `midnight_status` badge
- `Memory` interface now includes `midnightAddress` and `midnightStatus`; keepsake API mapping passes both fields through
- `SeedPhraseModal` — 4-step flow with 2-word spot-check verification before backup is confirmed; X button and close blocked during reveal/verify steps
- Footer: "Optional privacy protection" → "Rational privacy protection"
- `README.md` — Cardano badge updated to mainnet; added required "This project is built on the Midnight Network." sentence
- Plugin version bump 1.1.0 → 1.1.1

### Fixed
- Policy wallet balance diagnostic tool added to WP admin — shows raw Anvil API response, HTTP status, and lovelace value to diagnose balance unavailability without SSH access

---

## [1.1.0] - 2026-04-18

### Added

#### Midnight Sidecar (dual-chain integration)
- **Compact contract** (`midnight/contracts/memory_token.compact`) — 8 ZK circuits: `mintMemory`, `proveOwnership`, `proveCreatedBefore`, `proveContentAuthentic`, `proveContainsTag`, `updateTag`, `transferMemory`, `revokeMemory`
- **Express sidecar service** (`midnight/service/`) — TypeScript/Node.js API wrapping the Midnight SDK
  - `POST /api/v1/midnight/mint` — deploys memory_token contract, returns contract address
  - `POST /api/v1/midnight/:addr/prove` — generates ZK proof (ownership, created_before, content_authentic, contains_tag)
  - `POST /api/v1/midnight/:addr/transfer` — re-encrypts and transfers memory to new owner
  - `POST /api/v1/midnight/:addr/tag` — updates tag count
  - `POST /api/v1/midnight/:addr/revoke` — permanently revokes memory (irreversible)
  - `GET /health` — returns sidecar + proof server status
- **`MidnightService`** (`plugin/memory-mint/includes/services/class-midnight-service.php`) — PHP client for calling the sidecar from WordPress
- **`/mint/midnight/{id}` REST endpoint** (`POST memorymint/v1/mint/midnight/{keepsake_id}`) — registers a Keepsake on Midnight after Cardano mint confirms; handles both Standard (Cardano + Midnight) and Private (Midnight-only) paths
- **Midnight Sidecar settings section** in WordPress admin — Sidecar URL, API Secret, and Test Connection button

#### Two Keepsake tiers
- **Standard Keepsake** — Cardano public shell (blurred thumbnail, title, timestamp) + Midnight private truth (encrypted content, ZK proofs)
- **Private Keepsake** — Midnight only, zero public record, even existence is private

#### Schema additions (`wp_memorymint_keepsakes`)
- `keepsake_type` enum(`standard`, `private`) — chosen at creation time
- `content_hash` varchar(64) — SHA-256 of raw file bytes; used by `proveContentAuthentic` circuit
- `geo_hash` varchar(64) — SHA-256 of geohash string; passed to Midnight contract
- `tag_count` tinyint — number of people tags; passed to Midnight contract
- `thumbnail_url` text — blurred thumbnail IPFS URL (populated when IPFS encryption is built)
- `midnight_address` varchar(128) — Midnight contract address returned after sidecar mint
- `midnight_status` enum(`pending`, `minting`, `minted`, `failed`, `skipped`) — tracks Midnight registration independently from Cardano `mint_status`

#### Documentation
- `README.md` — full dual-chain documentation: two Keepsake tiers, content encryption model (CEK from CIP-30 signData), authentication lifecycle, wallet compatibility matrix, all flows, Cardano and Midnight API references
- `FLOWS.md` — sequence diagrams for all 8 flows: mint standard, mint private, view/decrypt, auth lifecycle, ZK proof, transfer with re-encryption, sharing
- `CHANGELOG.md` — this file

### Changed
- `POST /memorymint/v1/keepsakes` — now accepts `keepsake_type`, `geo_hash`, `tag_count`; computes `content_hash` server-side at creation
- Keepsake API response now includes `keepsake_type`, `content_hash`, `thumbnail_url`, `tag_count`, `midnight_address`, `midnight_status`
- Plugin description updated to reflect dual-chain nature (Cardano + Midnight)

### Technical Details

**Architecture: sponsored mints + per-user private state**
- Platform DUST wallet (`MIDNIGHT_WALLET_SEED`) pays all Midnight transaction fees
- Per-user Midnight `sk` derived from BIP-39 mnemonic via HMAC-SHA256 — deterministic, domain-separated from Cardano derivation
- Fresh `inMemoryPrivateStateProvider()` per request — no cross-user state bleed
- User `sk` never stored in sidecar — derived on-demand from mnemonic per request

**Proof server configuration**
- Local Docker proof server required: `midnightntwrk/proof-server:8.0.3` on port 6300
- Remote proof server (`proof-server.preprod.midnight.network`) has WAF blocking payloads >~8KB; mintMemory prover is 2.7MB → always 403

**Smoke test status (preprod, 2026-04-18)**
- `deployContract` ✅
- `mintMemory` ✅
- `proveOwnership` ✅ (`verified: true`, txId confirmed on-chain)

**Midnight SDK versions (pinned)**
- `@midnight-ntwrk/midnight-js`: 4.0.4
- `@midnight-ntwrk/compact-runtime`: 0.15.0
- `@midnight-ntwrk/ledger-v8`: 8.0.3
- `@midnight-ntwrk/wallet-sdk-facade`: 3.0.0
- `@midnight-ntwrk/wallet-sdk-dust-wallet`: 3.0.0

**Files added**
- `midnight/contracts/memory_token.compact`
- `midnight/docker-compose.yml`
- `midnight/package.json`
- `midnight/service/src/index.ts`
- `midnight/service/src/config.ts`
- `midnight/service/src/middleware/auth.ts`
- `midnight/service/src/midnight/contract.ts`
- `midnight/service/src/midnight/provider.ts`
- `midnight/service/src/midnight/inMemoryPrivateStateProvider.ts`
- `midnight/service/src/routes/health.ts`
- `midnight/service/src/routes/mint.ts`
- `midnight/service/src/routes/prove.ts`
- `midnight/service/src/routes/transfer.ts`
- `midnight/service/src/routes/tag.ts`
- `midnight/service/src/routes/revoke.ts`
- `midnight/service/tsconfig.json`
- `midnight/service/Dockerfile`
- `plugin/memory-mint/includes/services/class-midnight-service.php`
- `README.md`
- `FLOWS.md`
- `CHANGELOG.md`

**Files modified**
- `plugin/memory-mint/memory-mint.php` — version bump 1.0.0 → 1.1.0
- `plugin/memory-mint/includes/class-activator.php` — 7 new keepsake columns, 2 new options
- `plugin/memory-mint/includes/api/class-keepsake-api.php` — new fields in create + format
- `plugin/memory-mint/includes/api/class-mint-api.php` — `/mint/midnight/{id}` endpoint
- `plugin/memory-mint/admin/class-admin-page.php` — Midnight settings registration + test handler
- `plugin/memory-mint/admin/views/settings.php` — Midnight Sidecar UI section
- `.gitignore` — added midnight exclusions (`.env`, `node_modules/`, `dist/`, `contracts/managed/`)

---

## [1.0.0] - 2026-04-15

### Added

#### WordPress Plugin (`plugin/memory-mint/`)
- **Authentication** — email OTP login + CIP-30 wallet connect (both paths fully implemented)
- **Cardano wallet** — BIP-39 generated server-side (`CardanoWalletPHP`), seed stored encrypted; user can export via SeedPhraseModal
- **Two mint paths** — custodial (`/mint/custodial-sign`) and self-custody (`/mint/build` + `/mint/sign`)
- **Policy wallet** — native script, encrypted skey, co-signs every mint
- **CIP-25 metadata** — name, description, image (IPFS), mediaType, creator, timestamp, privacy
- **Keepsake CRUD** — create, list, get, update, delete
- **Gallery** — public and private gallery endpoints
- **Share links** — shareable links with email invites, expiry, and revocation
- **Transactions** — full transaction history with status tracking
- **Albums** — group keepsakes into albums

**REST API routes (31 total)**
- Auth (13): wallet-connect, email-connect, email-verify, verify, refresh, logout, me, seed-phrase, confirm-backup, delete-account, export, contact
- Mint (7): build, sign, custodial-sign, price, status, retry, wallet-balance
- Keepsakes (5): create, list, get, update, delete, public
- Gallery (2): user gallery, public gallery
- Share (5): create, get, revoke, list, public access

#### Next.js 15 Frontend (`frontend/`)
- Full mint flow, gallery, account management, share link pages
- `SeedPhraseModal.tsx` — shows user BIP-39 seed for self-custody export
- `app/midnight/` — stub pages (coming soon)

#### Cardano minting via Anvil API
- Native script policy wallet
- CIP-25 metadata standard
- Preprod and Mainnet network support
- Service fee collection in ADA

### Technical Details

**Stack**
- WordPress PHP plugin — REST API backend
- Next.js 15 — frontend
- Anvil API — Cardano transaction building and submission
- Pinata — IPFS pinning
- CIP-25 — NFT metadata standard

---

## Version Numbering

- **Major (X.0.0)** — Breaking changes, complete architectural overhaul
- **Minor (0.X.0)** — New features, new integrations, non-breaking additions
- **Patch (0.0.X)** — Bug fixes, minor improvements, hotfixes
