# Changelog

All notable changes to MemoryMint will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
