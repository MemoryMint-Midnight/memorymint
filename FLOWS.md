# MemoryMint — Dual-Chain Flow Reference

This document describes the end-to-end flows that coordinate the Cardano and Midnight layers of MemoryMint. Each flow shows exactly which chain is touched, in what order, and what data crosses the boundary between them.

---

## The Two-Chain Model

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│           CARDANO               │    │           MIDNIGHT               │
│         (public layer)          │    │         (private layer)          │
│                                 │    │                                  │
│  CIP-25 NFT                     │    │  Compact contract per memory     │
│  ├── title                      │    │  ├── contentHash (SHA-256)       │
│  ├── description                │    │  ├── ownerCommitment (hash)      │
│  ├── IPFS media URL             │◄──►│  ├── memoryTimestamp             │
│  ├── mediaType                  │    │  ├── geoHash (SHA-256)           │
│  ├── creator: "Memory Mint"     │    │  ├── tagCount                    │
│  ├── timestamp                  │    │  ├── cardanoAssetId (SHA-256)    │
│  └── privacy setting            │    │  ├── transferCount               │
│                                 │    │  └── revoked                     │
│  Visible to anyone              │    │  Readable by owner only          │
│  Transferable (standard NFT)    │    │  ZK-provable to anyone           │
└─────────────────────────────────┘    └─────────────────────────────────┘
                   ▲                                    ▲
                   │                                    │
                   └──────── cardanoAssetId ────────────┘
                     SHA-256(policyId ++ assetName)
                     stored on Midnight — links the two
```

The cross-chain link is one-way by design: Midnight knows about the Cardano NFT (via `cardanoAssetId`), but Cardano has no knowledge of the Midnight contract. This ensures the public chain contains no privacy-sensitive data.

---

## Flow 1: Minting a Memory — Custodial (Email) Path

For users who sign up with email and have no existing crypto wallet.

```
USER                    FRONTEND              WORDPRESS API           MIDNIGHT SIDECAR
 │                          │                      │                        │
 │  1. Sign up with email   │                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  POST /auth/email-connect                     │
 │                          ├─────────────────────►│                        │
 │  2. Receive OTP by email │◄─────────────────────┤                        │
 │                          │  POST /auth/email-verify (OTP)                │
 │                          ├─────────────────────►│                        │
 │                          │                      │  generate BIP-39 wallet│
 │                          │                      │  (CardanoWalletPHP.php)│
 │                          │                      │  encrypt + store seed  │
 │  3. Receive session token│◄─────────────────────┤                        │
 │     + Cardano address    │                      │                        │
 │                          │                      │                        │
 │  4. Upload photo + details                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  [public keepsake — no encryption]            │
 │                          │  POST /upload        │                        │
 │                          ├─────────────────────►│                        │
 │                          │                      │  store file → WordPress│
 │                          │                      │  compute SHA-256 →     │
 │                          │                      │  contentHash           │
 │                          │                      │  compute SHA-256 →     │
 │                          │                      │  geoHash               │
 │                          │                      │  create keepsake record│
 │                          │◄─────────────────────┤                        │
 │                          │                      │                        │
 │  5. Pay (fiat)           │                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  POST /mint/custodial-sign                    │
 │                          ├─────────────────────►│                        │
 │                          │                      │  check wallet ≥ 2.5 ADA│
 │                          │                      │  build CIP-25 tx       │
 │                          │                      │  (Anvil API)           │
 │                          │                      │  decrypt user skey     │
 │                          │                      │  user signs tx         │
 │                          │                      │  policy wallet co-signs│
 │                          │                      │  submit to Cardano ────┼──► CARDANO
 │                          │                      │                        │    CIP-25 NFT minted
 │                          │                      │  ◄── tx_hash,          │    policy_id, asset_name
 │                          │                      │      policy_id,        │
 │                          │                      │      asset_name        │
 │                          │                      │                        │
 │                          │                      │  POST /midnight/mint ──┼──────────────────►│
 │                          │                      │                        │  derive user sk    │
 │                          │                      │                        │  from mnemonic     │
 │                          │                      │                        │  compute           │
 │                          │                      │                        │  cardanoAssetId    │
 │                          │                      │                        │  deploy contract   │
 │                          │                      │                        │  call mintMemory() │
 │                          │                      │                        │  ────────────────► MIDNIGHT
 │                          │                      │  ◄── midnight_addr ────┼◄──────────────────│
 │                          │                      │                        │  private ledger
 │                          │                      │  update keepsake record│  initialized
 │  6. Memory minted ✓      │◄─────────────────────┤                        │
 │     Cardano NFT + Midnight│                     │                        │
 │     contract both live   │                      │                        │
```

---

## Flow 2: Minting a Memory — Self-Custody (CIP-30) Path

For users who connect an existing Cardano wallet (Nami, Eternl, Lace).

```
USER                    FRONTEND              WORDPRESS API           MIDNIGHT SIDECAR
 │                          │                      │                        │
 │  1. Connect wallet (CIP-30)                     │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  POST /auth/wallet-connect                    │
 │                          ├─────────────────────►│                        │
 │  2. Session token issued │◄─────────────────────┤                        │
 │     (no wallet generated)│                      │                        │
 │                          │                      │                        │
 │  3. Upload photo + details                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  [if private keepsake — encrypt before upload]│
 │                          │  sha256(file) → contentHash                   │
 │                          │  CIP-30 signData(addr,                        │
 │                          │    "memorymint:decrypt:v1:" + contentHash)    │
 │                          │  HKDF(signature) → CEK (256-bit AES-GCM key) │
 │                          │  AES-GCM encrypt file → encrypted blob        │
 │                          │  [server never sees plaintext or CEK]         │
 │                          │                      │                        │
 │                          │  POST /upload (encrypted blob)                │
 │                          ├─────────────────────►│                        │
 │                          │                      │  store file → WordPress│
 │                          │  POST /keepsakes     │                        │
 │                          │  { is_encrypted: true, content_hash }         │
 │                          ├─────────────────────►│                        │
 │                          │                      │  store original hash   │
 │                          │                      │  (pre-encryption)      │
 │                          │◄─────────────────────┤                        │
 │                          │                      │                        │
 │  4. Request mint         │                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  POST /mint/build    │                        │
 │                          ├─────────────────────►│                        │
 │                          │                      │  build unsigned tx     │
 │                          │                      │  (Anvil API)           │
 │                          │◄─────────────────────┤                        │
 │                          │  unsigned tx hex     │                        │
 │  5. Browser wallet signs │                      │                        │
 │     (CIP-30 signTx)      │                      │                        │
 │◄────────────────────────►│                      │                        │
 │                          │  POST /mint/sign     │                        │
 │                          │  (signed tx hex)     │                        │
 │                          ├─────────────────────►│                        │
 │                          │                      │  add policy co-sig     │
 │                          │                      │  submit to Cardano ────┼──► CARDANO
 │                          │                      │                        │    CIP-25 NFT minted
 │                          │                      │  POST /midnight/mint ──┼──────────────────►│
 │                          │                      │                        │  same as custodial │
 │                          │                      │                        │  ────────────────► MIDNIGHT
 │  6. Memory minted ✓      │◄─────────────────────┤                        │
```

---

## Flow 3: Decrypting a Private Memory (Gallery)

The owner opens a private encrypted keepsake in their gallery. Decryption happens entirely in the browser — the server never holds or derives the CEK.

```
OWNER                   FRONTEND              WORDPRESS API
 │                          │                      │
 │  1. Open gallery         │                      │
 ├─────────────────────────►│                      │
 │                          │  GET /keepsakes      │
 │                          ├─────────────────────►│
 │                          │◄─────────────────────┤
 │                          │  { is_encrypted: true, content_hash, file_url }
 │                          │                      │
 │  2. Click private memory │                      │
 ├─────────────────────────►│                      │
 │                          │  detect is_encrypted = true
 │                          │  → show "Decrypting…" overlay
 │                          │                      │
 │  3. Browser wallet signs │                      │
 │     (CIP-30 signData)    │                      │
 │     payload:             │                      │
 │     "memorymint:decrypt:v1:" + contentHash       │
 │◄────────────────────────►│                      │
 │                          │  HKDF(signature) → CEK
 │                          │                      │
 │                          │  fetch encrypted file from file_url
 │                          │  AES-GCM decrypt in browser
 │                          │  → blob URL (never leaves browser)
 │                          │                      │
 │  4. Full-resolution      │                      │
 │     decrypted image/video│                      │
 │     displayed            │                      │
 │                          │                      │
 │  [No wallet connected]   │                      │
 │                          │  show "Connect a Cardano wallet to decrypt"
 │                          │                      │
 │  [Custodial / email user]│                      │
 │                          │  show "Import your seed phrase into a
 │                          │   Cardano wallet (Lace, Eternl) to decrypt"
```

---

## Flow 5: Generating a ZK Proof

The owner proves something about their memory to a third party. No private data is ever disclosed.

```
OWNER                   FRONTEND              WORDPRESS API           MIDNIGHT SIDECAR
 │                          │                      │                        │
 │  1. Select proof type    │                      │                        │
 │     and target memory    │                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │  POST /midnight/:addr/prove                   │
 │                          │  { proofType, userMnemonic }                  │
 │                          ├─────────────────────►│                        │
 │                          │                      │  POST /midnight/prove ─┼──────────────────►│
 │                          │                      │                        │  derive sk from    │
 │                          │                      │                        │  mnemonic          │
 │                          │                      │                        │                    │
 │                          │                      │                        │  ┌─ proofType? ────┤
 │                          │                      │                        │  │                 │
 │                          │                      │                        │  ├─ "ownership"    │
 │                          │                      │                        │  │  proveOwnership()
 │                          │                      │                        │  │  assert: ownerCommitment
 │                          │                      │                        │  │       == ownerPublicKey(sk)
 │                          │                      │                        │  │  reveals: NOTHING
 │                          │                      │                        │  │                 │
 │                          │                      │                        │  ├─ "created_before"
 │                          │                      │                        │  │  proveCreatedBefore(cutoff)
 │                          │                      │                        │  │  assert: memoryTimestamp
 │                          │                      │                        │  │       < cutoffTimestamp
 │                          │                      │                        │  │  reveals: cutoff only
 │                          │                      │                        │  │  (actual timestamp hidden)
 │                          │                      │                        │  │                 │
 │                          │                      │                        │  ├─ "content_authentic"
 │                          │                      │                        │  │  proveContentAuthentic()
 │                          │                      │                        │  │  assert: contentHash
 │                          │                      │                        │  │       == secretContentHash()
 │                          │                      │                        │  │  reveals: NOTHING
 │                          │                      │                        │  │                 │
 │                          │                      │                        │  └─ "contains_tag"
 │                          │                      │                        │     proveContainsTag()
 │                          │                      │                        │     assert: tagCount > 0
 │                          │                      │                        │     reveals: NOTHING
 │                          │                      │                        │                    │
 │                          │◄─────────────────────┼────────────────────────┼── ZK proof returned│
 │  2. Proof displayed      │◄─────────────────────┤                        │
 │     Can be shared,       │                      │                        │
 │     attached to share    │                      │                        │
 │     link, or downloaded  │                      │                        │
 │                          │                      │                        │
 │                          │                      │                        │
VERIFIER receives proof                            │                        │
 │                          │                      │                        │
 │  3. Verify proof         │                      │                        │
 │     against contract     │                      │                        │
 │     address              │                      │                        │
 │     → confirms claim     │                      │                        │
 │     → learns nothing     │                      │                        │
 │       else               │                      │                        │
```

---

## Flow 6: Transferring Ownership

Both chains must be updated when ownership transfers. They are coordinated by the platform but are independent on-chain transactions.

```
CURRENT OWNER           FRONTEND              WORDPRESS API           MIDNIGHT SIDECAR
 │                          │                      │                        │
 │  1. Initiate transfer    │                      │                        │
 │     specify new owner    │                      │                        │
 ├─────────────────────────►│                      │                        │
 │                          │                      │                        │
 │  ── STEP A: Cardano ──────────────────────────────────────────────────── │
 │                          │                      │                        │
 │                          │  Build Cardano transfer tx (Anvil API)        │
 │                          │  CIP-25 NFT sent to new owner's address       │
 │                          │  ──────────────────────────────────────────► CARDANO
 │                          │                      │                        │  NFT now in
 │                          │                      │                        │  new owner's wallet
 │                          │                      │                        │
 │  ── STEP B: Midnight ─────────────────────────────────────────────────── │
 │                          │                      │                        │
 │                          │  POST /midnight/:addr/transfer                │
 │                          │  { userMnemonic (current), newOwnerMnemonic } │
 │                          ├─────────────────────►│                        │
 │                          │                      │  POST /midnight/transfer
 │                          │                      ├───────────────────────►│
 │                          │                      │                        │  derive current sk
 │                          │                      │                        │  derive new owner sk
 │                          │                      │                        │  compute new commitment:
 │                          │                      │                        │  persistentHash(
 │                          │                      │                        │    ["memorymint:owner:", newSk])
 │                          │                      │                        │  call transferMemory():
 │                          │                      │                        │  assert current ownership ✓
 │                          │                      │                        │  assert new != old ✓
 │                          │                      │                        │  write new ownerCommitment
 │                          │                      │                        │  increment transferCount
 │                          │                      │                        │  ──────────────────► MIDNIGHT
 │                          │                      │                        │  private ledger updated
 │  2. Transfer complete    │◄─────────────────────┤                        │
 │                          │                      │                        │
 │  RESULT:                 │                      │                        │
 │  Cardano: new owner holds NFT                   │                        │
 │  Midnight: new owner controls private ledger    │                        │
 │  transferCount: incremented on Midnight         │                        │
 │  Both chains consistent                         │                        │
```

---

## Flow 7: Sharing a Memory

The share system grants third-party access to a memory without transferring ownership.

```
OWNER                   FRONTEND              WORDPRESS API
 │                          │                      │
 │  1. Create share link    │                      │
 ├─────────────────────────►│                      │
 │                          │  POST /share/create  │
 │                          │  { keepsake_id, permissions }
 │                          ├─────────────────────►│
 │                          │                      │  generate share token
 │                          │                      │  create share record
 │                          │◄─────────────────────┤
 │                          │  share URL returned  │
 │  memorymint.fun/share/:token                    │
 │                          │                      │
 │  2. Optionally attach ZK proof                  │
 │     (run Flow 3 first, attach proof to token)   │
 │                          │                      │
 │  3. Share URL with recipient                    │
 │     (or send via email: POST /share/email)      │
 │                          │                      │
RECIPIENT                   │                      │
 │                          │                      │
 │  4. Opens share URL      │                      │
 ├─────────────────────────►│                      │
 │                          │  GET /share/:token   │
 │                          ├─────────────────────►│
 │                          │                      │  validate token
 │                          │                      │  fetch keepsake
 │                          │◄─────────────────────┤
 │  5. Sees:                │                      │
 │     - NFT title + description                   │
 │     - IPFS media (photo/video)                  │
 │     - Any attached ZK proofs                    │
 │     - NOT: location, timestamp, tags, content hash
 │       (those remain on Midnight private ledger) │
 │                          │                      │
 │  6. Can verify any ZK proofs against            │
 │     Midnight contract address                   │
 │     without learning private metadata           │
 │                          │                      │
OWNER                       │                      │
 │  7. Revoke if needed     │                      │
 ├─────────────────────────►│                      │
 │                          │  DELETE /share/:id   │
 │                          ├─────────────────────►│
 │                          │                      │  token invalidated
 │  share link dead         │◄─────────────────────┤
```

---

## Data Boundary Summary

This table shows exactly what data each party can see at each stage.

| Data | Owner | Recipient (shared) | General Public | Verifier (proof) |
|---|---|---|---|---|
| NFT title | ✅ | ✅ | ✅ | ✅ |
| NFT description | ✅ | ✅ | ✅ | ✅ |
| IPFS media | ✅ | ✅ (if shared) | ✅ (if public) | ✅ |
| Exact timestamp | ✅ | ❌ | ❌ | ❌ |
| Location | ✅ | ❌ | ❌ | ❌ |
| Tags | ✅ | ❌ | ❌ | ❌ |
| Content hash | ✅ | ❌ | ❌ | ❌ |
| "Created before X" | ✅ | ❌ | ❌ | ✅ (ZK proof) |
| "Is the owner" | ✅ | ❌ | ❌ | ✅ (ZK proof) |
| "Has original content" | ✅ | ❌ | ❌ | ✅ (ZK proof) |
| "Has tags" | ✅ | ❌ | ❌ | ✅ (ZK proof) |
| Secret key | Owner only | ❌ | ❌ | ❌ |

ZK proofs let the owner selectively prove specific facts to verifiers without ever opening up the rest of the private ledger.

---

## Sequence of Chain Operations Per Flow

| Flow | Cardano first? | Midnight first? | Notes |
|---|---|---|---|
| Mint (custodial) | ✅ Cardano first | Midnight second | Cardano asset ID must exist before Midnight registration |
| Mint (wallet, private) | Browser encrypt first | Cardano second, Midnight third | AES-GCM encryption happens before any upload |
| Decrypt (gallery) | — | — | Browser-only; wallet signs → CEK derived → decrypt in-memory |
| Prove | — | ✅ Midnight only | Cardano is not involved in proof generation |
| Transfer | ✅ Cardano first | Midnight second | NFT transferred, then Midnight ownership updated |
| Share | — | — | Neither chain directly involved — platform DB only |
| Share + Proof | — | ✅ Midnight only | Proof generated from Midnight, attached to share |
| Revoke | — | ✅ Midnight only | Midnight ledger sealed; Cardano NFT remains (immutable) |
