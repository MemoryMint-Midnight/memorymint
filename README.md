<p align="center">
  <img src="assets/logo.png" alt="MemoryMint" width="320" />
</p>

<h1 align="center">MemoryMint</h1>

<p align="center">
  <strong>Your memories, preserved forever. Private by default. Provable on demand.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cardano-mainnet-blue?logo=cardano" alt="Cardano" />
  <img src="https://img.shields.io/badge/Midnight-preprod-purple" alt="Midnight" />
  <img src="https://img.shields.io/badge/version-1.1.0-green" alt="Version" />
  <img src="https://img.shields.io/badge/status-private%20beta-orange" alt="Status" />
</p>

---

## What is MemoryMint?

MemoryMint is for everyone — not just crypto users.

Think of it as a permanent, private digital safe for your most important moments. You upload a photo, video, or memory. We preserve it forever. No one can alter it, delete it, or access it without your permission — not even us.

**No crypto knowledge needed.** Pay with a card. We handle everything behind the scenes.

What makes MemoryMint different from cloud storage or social media:

- **It's permanent.** Once minted, your memory cannot be deleted by any platform, company, or server going offline.
- **It's private.** Your content is encrypted on your device before it ever leaves. We never see what you upload.
- **It's provable.** You can prove a memory is yours, prove it existed before a certain date, or prove its content is authentic — without revealing the memory itself. This is made possible by zero-knowledge cryptography on the Midnight blockchain.
- **It's yours.** You hold the key. You can take your memories to any compatible wallet. No lock-in.

---

## For the technically curious

This project is built on the Midnight Network.

MemoryMint is a dual-chain platform:

- **Cardano** — the public layer. A permanent ownership record anyone can verify. If you choose a Standard Keepsake, a blurred thumbnail is visible on-chain — proof it exists, nothing more.
- **Midnight** — the private layer. Your actual content, location, tags, and timestamps are stored in a ZK-provable private ledger. Only you can read them. Anyone can verify proofs about them without seeing the data.

**The result:** you can prove a memory is yours, prove it predates a given date, prove the content has not been tampered with — all without ever disclosing the memory itself.

---

## Two Keepsake Tiers

MemoryMint offers two mint paths. Users choose based on how much privacy they want.

### Standard Keepsake (Cardano + Midnight)

A Cardano Keepsake (CIP-25) is minted with a **blurred thumbnail** as its public image. The actual memory content is encrypted client-side before going to IPFS — the IPFS hash of the encrypted content is stored privately on Midnight. Nothing about the real content appears on any public chain.

- Visible in all Cardano wallets (Lace, Eternl, Nami, etc.) as a blurred thumbnail
- Visible on block explorers (CardanoScan, pool.pm) as a blurred thumbnail
- Content viewable only by the owner, authenticated via any CIP-30 wallet
- ZK proofs generated on Midnight for ownership, date, authenticity, and tags
- Transferable as a Cardano Keepsake with coordinated Midnight ownership update

> **The world sees:** a blurred Keepsake exists, owned by address X, minted on date Y. Nothing else.

### Private Keepsake (Midnight only)

No Cardano Keepsake is created. The memory exists only on Midnight — not visible on any public chain or in any Cardano wallet.

- Zero public record — even the existence of the memory is private
- Requires a Midnight-compatible wallet (Lace or 1AM) to access
- Full ZK proof capability on Midnight
- Not transferable as a standard Keepsake (Midnight-only transfer via `transferMemory` circuit)

> **The world sees:** nothing.

---

## Architecture

```
User (fiat / Cardano wallet / Midnight wallet)
        │
        ▼
WordPress REST API backend (PHP plugin)
        │
        ├── Auth layer
        │       ├── Email OTP → wallet generation (new users, transitional only)
        │       ├── CIP-30 wallet connect (Cardano wallets — Lace, Eternl, Nami)
        │       └── Midnight DApp Connector (Lace, 1AM)
        │
        ├── Cardano layer (Anvil API) — Standard Keepsake only
        │       ├── Policy wallet co-signs every mint (native script)
        │       ├── Keepsake (CIP-25) with blurred thumbnail → Cardano chain
        │       └── Self-custody or custodial signing
        │
        ├── IPFS layer (Pinata)
        │       ├── Blurred thumbnail (public — linked in Cardano Keepsake)
        │       └── Encrypted memory content (unreadable without owner's key)
        │
        └── Midnight sidecar (Node.js / Express — WSL2 / server)
                └── One Compact contract deployed per memory
                        └── Private ledger: hashes + ZK circuits
```

---

## Content Encryption

All memory content is encrypted in the user's **browser** before leaving their device. The server never sees plaintext content or the content encryption key (CEK).

### Key Derivation

The CEK is derived from the user's Cardano wallet signature — deterministic, never stored:

```
challenge = "memorymint:decrypt:v1:" + contentHash
signature = cardanoWallet.signData(address, challenge)   ← stays inside the wallet
CEK       = HKDF(signature, "memorymint:cek:v1")
```

The same wallet + the same memory = the same CEK, every time. No key database. No server-side decryption.

### IPFS Storage

Two separate IPFS files are created per Standard Keepsake:

| File | Content | Who can read it |
|---|---|---|
| Blurred thumbnail | Low-resolution blurred version of the original | Anyone (linked in Cardano Keepsake) |
| Encrypted content | `encrypt(originalContent, CEK)` — binary blob | Owner only (after wallet sign) |

The encrypted content's IPFS hash is stored exclusively in the Midnight private ledger. It never appears on Cardano.

---

## Authentication Lifecycle

MemoryMint uses a **wallet-only** login model. Email OTP is a transitional tool for onboarding users who do not yet have a wallet.

### Stage 1 — New User (no wallet)

1. User signs up with email → OTP sent → verified → session issued
2. Platform generates BIP-39 wallet server-side (`CardanoWalletPHP.php`)
3. Seed encrypted and stored; `SeedPhraseModal` shown immediately
4. **Every login requires OTP** until seed backup is confirmed
5. OTP at login = signal that the account is still custodial and at risk

### Stage 2 — Seed Backup Confirmed

1. User writes down their 24-word seed phrase (shown in `SeedPhraseModal`)
2. Confirms backup via checkbox in the modal
3. Platform sets `seed_backed_up = true` in the user database
4. OTP login permanently disabled for that account
5. User imports seed into Lace or 1AM to get a self-custody wallet

### Stage 3 — Wallet-Only (permanent)

- Connect CIP-30 wallet → sign challenge → authenticated + can decrypt content
- No email, no OTP, no server dependency for authentication
- Lost wallet = restore from seed phrase (user's responsibility — they confirmed backup)

---

## Wallet Compatibility

| Wallet | Mint (Standard) | View content | ZK proofs | Mint (Private) |
|---|---|---|---|---|
| Lace (Cardano + Midnight) | ✅ | ✅ CIP-30 sign | ✅ | ✅ |
| Eternl / Nami (Cardano only) | ✅ | ✅ CIP-30 sign | ✅ via platform | ❌ |
| 1AM (Midnight only) | ❌ | ✅ Midnight sign | ✅ | ✅ |
| No wallet (fiat/custodial) | ✅ | ✅ server-assisted sign | ✅ via platform | ❌ |

All paths (including custodial) support full content viewing. No user is locked out of their own memories.

---

## End-to-End Flows

### Flow 1: Minting a Standard Keepsake (Custodial / Email Path)

```
1. SIGN UP
   Email → OTP → session issued
   → Platform generates BIP-39 wallet (CardanoWalletPHP.php)
   → SeedPhraseModal shown — user prompted to back up seed

2. UPLOAD + ENCRYPT (browser-side)
   User selects photo/video + enters title, description, location, tags
   → Browser derives CEK from wallet signature
   → Browser encrypts content → encrypted blob → IPFS (Pinata)
   → Browser generates blurred thumbnail → IPFS (Pinata)
   → SHA-256 of original content computed → contentHash
   → SHA-256 of location string computed → geoHash
   → Keepsake record created in WordPress DB (status: pending)
   → Encrypted content IPFS hash stored (will go to Midnight only)

3. CARDANO MINT
   POST /mint/custodial-sign
   → Platform checks custodial wallet ≥ 2.5 ADA
   → Anvil API builds Keepsake mint transaction
   → CIP-25 metadata: { name, description, image: blurredThumbnailIPFS,
        mediaType, creator: "Memory Mint", timestamp, privacy: "encrypted" }
   → Platform decrypts user skey → signs transaction
   → Policy wallet co-signs (native script minting authority)
   → Submitted to Cardano → tx_hash, policy_id, asset_name returned
   → Poll until confirmed → keepsake record updated

4. MIDNIGHT REGISTRATION
   Platform backend calls sidecar POST /api/v1/midnight/mint
   → Sidecar derives user Midnight sk from mnemonic:
        HMAC-SHA256(key="memorymint:midnight:sk:v1", data=mnemonicToSeedSync(mnemonic))
   → Computes cardanoAssetId = SHA-256(policyId ++ assetName)
   → Deploys fresh Compact contract instance
   → Calls mintMemory() with private witnesses:
        { contentHash, timestamp, geoHash, tagCount, cardanoAssetId }
   → ownerCommitment = persistentHash(["memorymint:owner:", sk])
   → Returns midnight_addr → keepsake record updated

5. RESULT
   ┌─────────────────────────────────────────────────────┐
   │  Cardano (public):                                  │
   │    Keepsake (CIP-25) — blurred thumbnail visible    │
   │    Metadata: title, description, thumbnail IPFS     │
   │                                                     │
   │  IPFS (public URL, unreadable content):             │
   │    Encrypted memory blob — meaningless without CEK  │
   │                                                     │
   │  Midnight (private):                                │
   │    contentHash, ownerCommitment, memoryTimestamp,   │
   │    geoHash, tagCount, cardanoAssetId,               │
   │    encryptedContentIPFS (hash), initialized=true    │
   └─────────────────────────────────────────────────────┘
```

---

### Flow 2: Minting a Standard Keepsake (Self-Custody / CIP-30 Path)

```
1. CONNECT WALLET
   User connects Lace / Eternl / Nami via CIP-30
   → Address verified → session issued (no wallet generated server-side)

2. UPLOAD + ENCRYPT — same as custodial path
   Browser derives CEK from CIP-30 wallet signature
   Content encrypted in browser → IPFS
   Blurred thumbnail → IPFS

3. CARDANO MINT
   POST /mint/build → Anvil API builds unsigned CIP-25 tx
   → Unsigned tx hex returned to frontend
   → User's browser wallet signs (CIP-30 signTx)
   → Signed tx sent to POST /mint/sign
   → Platform adds policy co-signature → submitted to Cardano

4. MIDNIGHT REGISTRATION — same as custodial path

5. RESULT — same dual-chain outcome, full self-custody on Cardano
```

---

### Flow 3: Minting a Private Keepsake (Midnight Only)

```
1. CONNECT MIDNIGHT WALLET
   User connects Lace or 1AM via Midnight DApp Connector
   → Midnight address verified → session issued

2. UPLOAD + ENCRYPT (browser-side)
   Browser derives CEK from Midnight wallet signature
   Content encrypted → IPFS
   No blurred thumbnail created

3. MIDNIGHT REGISTRATION
   Platform calls sidecar POST /api/v1/midnight/mint
   → Deploys Compact contract
   → Calls mintMemory() with all private witnesses
   → Returns midnight_addr

4. RESULT
   ┌─────────────────────────────────────────────────────┐
   │  Cardano: nothing — no Keepsake, no public record   │
   │                                                     │
   │  Midnight (private):                                │
   │    Full private ledger — same as Standard           │
   │    encryptedContentIPFS stored privately            │
   │                                                     │
   │  Visible to the world: nothing                      │
   └─────────────────────────────────────────────────────┘
```

---

### Flow 4: Viewing a Keepsake (Browser-Side Decryption)

```
1. OWNER CONNECTS WALLET
   CIP-30 wallet (any Cardano wallet) or Midnight DApp Connector

2. PLATFORM REQUESTS SIGNATURE (browser-side)
   challenge = "memorymint:decrypt:v1:" + contentHash
   signature = wallet.signData(address, challenge)
   CEK       = HKDF(signature, "memorymint:cek:v1")
   [signature and CEK never leave the browser]

3. FETCH + DECRYPT (browser-side)
   Browser fetches encrypted blob from IPFS
   Browser decrypts using CEK → original content
   Server never sees CEK or plaintext

4. DISPLAY
   Original memory displayed in browser
   Server delivered only the encrypted IPFS blob
```

---

### Flow 5: Generating a ZK Proof

A ZK proof lets the owner prove something about their memory to a third party without revealing any private data.

```
proofType: "ownership"
→ proveOwnership() circuit
→ Proves: "I am the current owner of this memory"
→ Reveals: nothing

proofType: "created_before"
→ proveCreatedBefore(cutoffTimestamp) circuit
→ Proves: "This memory predates [cutoff date]"
→ Reveals: the cutoff date only — not the actual timestamp

proofType: "content_authentic"
→ proveContentAuthentic() circuit
→ Proves: "I hold the exact original content committed at mint"
→ Reveals: nothing — not the content, not the hash

proofType: "contains_tag"
→ proveContainsTag() circuit
→ Proves: "This memory has at least one tag"
→ Reveals: nothing
```

The proof is returned as a verifiable credential. A verifier can check it against the Midnight contract address without accessing any private ledger data.

---

### Flow 6: Transferring Ownership

Full transfer updates both chains and re-encrypts content for the new owner.

```
1. CURRENT OWNER INITIATES
   Specifies new owner (Cardano address + MemoryMint account or Midnight address)

2. CONTENT RE-ENCRYPTION (browser-side, Standard Keepsake only)
   Current owner's browser derives CEK → decrypts content
   New owner's public key used to derive their CEK
   Content re-encrypted → uploaded to IPFS (new hash)
   [Server never sees plaintext during this step]

3. CARDANO TRANSFER (Standard Keepsake only)
   Keepsake (CIP-25) sent from current owner to new owner

4. MIDNIGHT TRANSFER
   POST /api/v1/midnight/:addr/transfer
   → Sidecar derives current owner sk → proves ownership
   → Derives new owner commitment
   → Calls transferMemory() circuit:
        Asserts current ownership ✓
        Writes new ownerCommitment
        Increments transferCount
   → New owner now controls Midnight private state

5. RESULT
   New owner has:
   - Keepsake (CIP-25) in their Cardano wallet (Standard only)
   - Full Midnight private state access
   - Ability to decrypt content with their own wallet signature
```

---

### Flow 7: Sharing a Memory

The share system grants third-party access without transferring ownership.

```
1. OWNER CREATES SHARE LINK
   POST /share/create → unique token generated
   Optional: attach a ZK proof to the share link

2. RECIPIENT ACCESSES SHARE
   GET /share/:token → platform returns:
   - Keepsake title + description
   - Owner decrypts content → serves decrypted media to recipient
   - Any attached ZK proofs
   - NOT: location, timestamp, raw hashes, secret key

3. OWNER REVOKES
   DELETE /share/:id → token invalidated immediately
```

---

## Cardano Layer

### CIP-25 Metadata (Standard Keepsake — on-chain, public)

| Field | Value | Visibility |
|---|---|---|
| `name` | Keepsake title | Public |
| `description` | Keepsake description | Public |
| `image` | IPFS URL of **blurred thumbnail** | Public |
| `mediaType` | `image/*` | Public |
| `creator` | `"Memory Mint"` | Public |
| `timestamp` | Unix epoch of mint | Public |
| `privacy` | `"encrypted"` | Public |

The real content's IPFS hash is **not** in the Cardano metadata. It lives only on Midnight.

### Cardano REST API

All routes are under `/wp-json/memorymint/v1/`.

**Auth**

| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/wallet-connect` | Connect a CIP-30 wallet |
| `POST` | `/auth/midnight-connect` | Connect via Midnight DApp Connector |
| `POST` | `/auth/email-connect` | Request email OTP (new users without wallet) |
| `POST` | `/auth/email-verify` | Verify OTP and issue session token |
| `GET` | `/auth/verify` | Verify current session token |
| `POST` | `/auth/refresh` | Refresh session token |
| `POST` | `/auth/logout` | Invalidate session |
| `GET` | `/auth/me` | Get current user profile |
| `GET` | `/auth/seed-phrase` | Retrieve seed phrase for backup |
| `POST` | `/auth/confirm-backup` | Confirm seed backup → enables wallet-only login |
| `GET` | `/auth/export` | Export full account data |
| `DELETE` | `/auth/delete-account` | Delete account |

**Minting**

| Method | Route | Description |
|---|---|---|
| `POST` | `/mint/build` | Build unsigned Keepsake mint transaction |
| `POST` | `/mint/sign` | Add policy co-sig + submit (self-custody path) |
| `POST` | `/mint/custodial-sign` | Sign and submit on behalf of custodial user |
| `POST` | `/mint/midnight/:id` | Register Keepsake on Midnight after Cardano mint |
| `GET` | `/mint/price` | Get current mint price |
| `GET` | `/mint/status/:tx_hash` | Poll transaction confirmation |
| `POST` | `/mint/retry/:keepsake_id` | Retry a failed mint |
| `GET` | `/mint/wallet-balance` | Get user's Cardano ADA balance |

**Keepsakes**

| Method | Route | Description |
|---|---|---|
| `GET` | `/keepsakes` | List authenticated user's keepsakes |
| `POST` | `/keepsakes` | Create a new keepsake record |
| `GET` | `/keepsakes/:id` | Get a single keepsake |
| `PUT` | `/keepsakes/:id` | Update keepsake metadata |
| `DELETE` | `/keepsakes/:id` | Delete keepsake record |

**Gallery**

| Method | Route | Description |
|---|---|---|
| `GET` | `/gallery/public` | Public feed (blurred thumbnails only) |
| `GET` | `/gallery/shared/:token` | Access a shared keepsake by token |

**Sharing**

| Method | Route | Description |
|---|---|---|
| `POST` | `/share/create` | Generate a share link |
| `POST` | `/share/email` | Send share invite by email |
| `GET` | `/share/:token` | Access a shared keepsake |
| `DELETE` | `/share/:id` | Revoke a share link |
| `GET` | `/share/list/:keepsake_id` | List all share links for a keepsake |

---

## Midnight Layer

### Contract Overview

The Compact contract (`contracts/memory_token.compact`) implements 8 circuits. One contract instance is deployed per memory — each memory is completely isolated with its own private ledger state.

| Circuit | Description |
|---|---|
| `mintMemory` | Register a new memory on Midnight. All values supplied as private witnesses. Called once after Cardano mint (or immediately for Private Keepsakes). |
| `proveOwnership` | ZK proof that the caller is the current owner. Reveals nothing. |
| `proveCreatedBefore(cutoffTimestamp)` | ZK proof that the memory predates a given cutoff. Cutoff is a public argument; the actual timestamp is never revealed. |
| `proveContentAuthentic` | ZK proof that the caller holds the exact original content committed at mint. Proves authenticity without revealing the content. |
| `proveContainsTag` | ZK proof that the memory has at least one tag. Reveals nothing about the tags themselves. |
| `updateTag` | Increment the tag count. Owner-gated. |
| `transferMemory` | Transfer ownership to a new owner. Asserts current ownership, writes new owner commitment, increments transferCount. |
| `revokeMemory` | Permanently revoke the memory. Irreversible. All circuits reject calls on a revoked memory. |

### Private Ledger Fields

| Field | Type | Description |
|---|---|---|
| `initialized` | `Boolean` | Guards against double-mint |
| `contentHash` | `Bytes<32>` | SHA-256 of the original plaintext content |
| `ownerCommitment` | `Bytes<32>` | `persistentHash(["memorymint:owner:", secretKey])` |
| `memoryTimestamp` | `Uint<64>` | Unix epoch (seconds) when the memory was captured |
| `geoHash` | `Bytes<32>` | SHA-256 of the location string |
| `tagCount` | `Uint<32>` | Number of tags attached |
| `cardanoAssetId` | `Bytes<32>` | SHA-256 of `(policyId ++ assetName)` — links to Cardano Keepsake |
| `transferCount` | `Counter` | Increments on every ownership transfer |
| `revoked` | `Boolean` | True if permanently revoked |

### Ownership Pattern

```
ownerCommitment = persistentHash<Vector<2, Bytes<32>>>([pad(32, "memorymint:owner:"), secretKey])
```

The domain separator prevents collision with other Midnight contracts. To prove ownership, the caller supplies `localSecretKey()` as a private witness and the circuit asserts `ownerPublicKey(localSecretKey()) == ownerCommitment`.

### Per-User Secret Key Derivation

The Midnight `sk` is derived deterministically from the user's BIP-39 mnemonic:

```
sk = HMAC-SHA256(
  key  = "memorymint:midnight:sk:v1",
  data = mnemonicToSeedSync(mnemonic)
)
```

The same seed phrase the user holds for their Cardano wallet extends to Midnight. One 24-word phrase covers both chains.

### Midnight Sidecar REST API

All routes require `x-api-secret` header. Sidecar runs on port 4000.

| Method | Route | Body |
|---|---|---|
| `GET` | `/health` | — |
| `POST` | `/api/v1/midnight/mint` | `{ userMnemonic, contentHash, timestamp, geoHash, tagCount, cardanoAssetId }` |
| `POST` | `/api/v1/midnight/:addr/prove` | `{ proofType, userMnemonic, [cutoffTimestamp] }` — `proofType`: `ownership` \| `created_before` \| `contains_tag` \| `content_authentic` |
| `POST` | `/api/v1/midnight/:addr/transfer` | `{ userMnemonic, newOwnerMnemonic }` |
| `POST` | `/api/v1/midnight/:addr/tag` | `{ userMnemonic }` |
| `POST` | `/api/v1/midnight/:addr/revoke` | `{ userMnemonic }` |

---

## Cross-Chain Link

The two chains are linked through `cardanoAssetId` — a SHA-256 hash of `(policyId ++ assetName)` stored on the Midnight private ledger. This creates a cryptographically verifiable binding between the public Cardano Keepsake and its private Midnight record without exposing the Cardano asset identity in plaintext on Midnight.

The link is intentionally one-way: Midnight knows about Cardano, but Cardano has no knowledge of Midnight.

---

## Privacy Guarantees

| What is stored | Where | Who can read it |
|---|---|---|
| Blurred thumbnail | IPFS (public URL in Cardano Keepsake) | Anyone |
| Encrypted memory content | IPFS (hash stored on Midnight only) | Owner only (browser decrypt) |
| SHA-256 of original content | Midnight private ledger | Owner only |
| SHA-256 of location | Midnight private ledger | Owner only |
| SHA-256 of Cardano asset ID | Midnight private ledger | Owner only |
| Unix timestamp of capture | Midnight private ledger | Owner only |
| Owner commitment (hash of sk) | Midnight private ledger | Owner only |
| Keepsake title, description | Cardano (public) | Anyone |
| Keepsake ownership record | Cardano (public) | Anyone |
| Content encryption key (CEK) | Never stored — derived on demand | Owner only (in browser) |

**No personal data — no names, faces, addresses, or coordinates — is ever stored on-chain at any layer. GDPR compliant by design.**

---

## Key Design Decisions

- **Two keepsake tiers** — Standard (Cardano + Midnight, public existence, private content) and Private (Midnight only, nothing public). Users choose based on their privacy needs.
- **Encrypted content before IPFS** — original content never leaves the browser unencrypted. Only the encrypted blob goes to IPFS.
- **CEK from CIP-30 signData** — content encryption key derived from a deterministic Cardano wallet signature. Any CIP-30 wallet can decrypt. No key storage needed anywhere.
- **Browser-side decryption only** — the platform server never holds or derives the CEK. Even a fully compromised server cannot read user content.
- **Blurred thumbnail on Cardano** — the public Keepsake image is always the blurred version. The real content IPFS hash exists only on Midnight.
- **Wallet-only authentication** — email OTP is transitional for new users only. Once the seed is confirmed backed up, login is wallet-only permanently.
- **One contract per memory** — each memory is an isolated contract instance. No shared state between users or memories.
- **Platform-sponsored Midnight fees** — the platform holds a DUST wallet funded from staking NIGHT. Users never touch DUST.
- **One seed, two chains** — the user's BIP-39 mnemonic derives both their Cardano wallet (standard BIP-44) and their Midnight sk (HMAC-SHA256 domain-separated). Exporting the seed once covers both chains.
- **GDPR by design** — no personal data on-chain at any layer.

---

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- `@midnight-ntwrk/dapp-connector-api` — Midnight DApp Connector
- Web Crypto API — browser-side AES-GCM encryption/decryption

### Backend
- WordPress PHP plugin (headless REST API)
- `CardanoWalletPHP.php` — BIP-39 wallet generation, seed encryption/decryption
- `CardanoTransactionSignerPHP.php` — policy wallet transaction co-signing
- Anvil API — hosted Cardano transaction building and submission
- Pinata — IPFS media storage

### Midnight Layer
- Compact smart contract language (compactc v0.30.0)
- `@midnight-ntwrk/midnight-js-*` SDK packages (v4.0.4)
- `@midnight-ntwrk/compact-runtime` (v0.15.0)
- `@midnight-ntwrk/ledger-v8` (v8.0.3)
- Node.js 22 / Express sidecar service
- Local Docker proof server (`midnightntwrk/proof-server:8.0.3`, port 6300)
- Midnight preprod / mainnet

### Cardano Layer
- Keepsake (CIP-25) standard
- CIP-30 wallet connector
- Anvil API (hosted transaction building)
- Native script policy wallet
- Preprod / mainnet

---

## Business Model

Users pay in fiat (Stripe or similar). Zero crypto friction — no wallet required to mint.

1. Platform converts fiat revenue → `$NIGHT` → stakes → earns `$DUST` yield
2. Platform DUST wallet sponsors all Midnight transaction fees
3. New email users receive a custodial Cardano wallet — full seed-phrase export always available
4. Once seed is backed up, users move to wallet-only self-custody
5. Cardano wallet users (CIP-30 connect) are self-custody from day one

---

## Project Status

| Component | Status |
|---|---|
| WordPress plugin — auth (email OTP + CIP-30) | ✅ Complete |
| WordPress plugin — custodial wallet generation | ✅ Complete |
| WordPress plugin — Cardano minting (both paths) | ✅ Complete |
| WordPress plugin — keepsake CRUD | ✅ Complete |
| WordPress plugin — gallery + sharing | ✅ Complete |
| WordPress plugin — Midnight sidecar integration | ✅ Complete |
| WordPress plugin — seed backup confirmation flag | 🔲 Planned |
| Next.js frontend — mint, gallery, account, share | ✅ Complete |
| Next.js frontend — `SeedPhraseModal` (seed display) | ✅ Complete |
| Next.js frontend — seed backup confirmation step | 🔲 Planned |
| Next.js frontend — wallet-only login gate | 🔲 Planned |
| Next.js frontend — CIP-30 + Midnight DApp Connector | 🔲 Planned |
| Next.js frontend — browser-side content encryption | 🔲 Planned |
| Next.js frontend — browser-side content decryption | 🔲 Planned |
| Next.js frontend — blurred thumbnail generation | 🔲 Planned |
| Compact contract — 8 circuits, smoke tested on preprod | ✅ Complete (2026-04-18) |
| Midnight sidecar — all routes | ✅ Complete |
| Content re-encryption on transfer | 🔲 Planned |
| Private Keepsake (Midnight-only mint path) | 🔲 Planned |
| `app/midnight/` pages (prove, transfer, revoke UI) | 🔲 Planned |
| Mainnet deployment | Pending ecosystem PR approval |

---

## Deployment Authorization

MemoryMint self-assessed against the Midnight Network Contract Deployment Rubric:

| Category | Score | Rationale |
|---|---|---|
| Privacy-at-Risk | **1** | Only SHA-256 hashes on the private ledger. No identity-level data. GDPR compliant by design. |
| Value-at-Risk | **1** | No funds locked in the Midnight contract. Platform DUST wallet pays fees externally. Zero financial blast radius from a contract exploit. |
| State-Space-at-Risk | **1** | One contract per memory, 9 fixed-size ledger fields. No dynamic arrays, no unbounded mappings. |

Full deployment authorization PR: `midnightntwrk/midnight-improvement-proposals`.

---

## Getting Started (Development)

### Prerequisites

- Node.js 22 via nvm (WSL2)
- WSL2 Ubuntu 24.04 — required for Midnight sidecar and Compact compiler
- Docker Engine inside WSL2 — for local proof server
- Compact compiler: `~/.compact/versions/0.30.0/x86_64-unknown-linux-musl/compactc`
- WordPress installation for the backend plugin
- Anvil API key
- Pinata API key

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### WordPress Plugin

Install `plugin/memory-mint/` into `wp-content/plugins/` and activate. Configure via the MemoryMint admin settings page.

### Midnight Sidecar (WSL2)

```bash
# Start the local proof server (Docker Engine in WSL2)
docker start midnight-proof
# Image: midnightntwrk/proof-server:8.0.3, port 6300

# Start the sidecar
cd midnight
set -a && source .env && set +a
./node_modules/.bin/tsx service/src/index.ts
# Runs on port 4000 — wallet sync takes ~8-10 min on cold start
```

Key `.env` values:
```
PROOF_SERVER_URL=http://localhost:6300    # local Docker — remote has WAF that blocks large proofs
MIDNIGHT_WALLET_SEED="word1 word2 ..."   # 24-word mnemonic — must be quoted
MIDNIGHT_API_SECRET=<your-secret>
```

### Recompile the Contract

```bash
~/.compact/versions/0.30.0/x86_64-unknown-linux-musl/compactc \
  midnight/contracts/memory_token.compact \
  midnight/contracts/managed
```

### Run Smoke Test

```bash
cd midnight
bash smoke_test.sh
# Expected: 3/3 PASSED (health + mint + proveOwnership)
```

---

## Adding Your Logo

To display your logo at the top of this README:

1. Create an `assets/` folder in the repo root
2. Add your logo as `assets/logo.png` (recommended: PNG with transparent background, ~600px wide)
3. Commit and push — it will appear automatically at the top of this page on GitHub

---

## Documentation

- [FLOWS.md](FLOWS.md) — Sequence diagrams for all flows
- [CHANGELOG.md](CHANGELOG.md) — Full version history

---

## License

MIT
