# Memory Mint — Frontend

Next.js 15 frontend for Memory Mint — a blockchain-based memory preservation platform built on Cardano and Midnight.

## Tech Stack

- **Next.js 15** — React framework with App Router
- **TypeScript** — Type safety throughout
- **Tailwind CSS** — Utility-first styling
- **Framer Motion** — Animations
- **Cardano** — NFT minting via WordPress/Anvil API
- **Midnight** — Privacy proofs via sidecar service
- **WordPress REST API** — Headless backend

## Getting Started

### Prerequisites

- Node.js 18+
- WordPress backend running (see root `SETUP.md`)
- Cardano wallet extension (Nami, Vespr, Eternl, Begin, or Lace) for wallet-user testing

### Installation

```bash
npm install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_WORDPRESS_API_URL

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (Header/Footer)
│   ├── page.tsx                 # Homepage
│   ├── mint/page.tsx            # Mint flow (upload → pay → confirm)
│   ├── gallery/page.tsx         # User's minted keepsake gallery
│   ├── memories/page.tsx        # Public memory feed
│   ├── account/page.tsx         # Account settings
│   ├── midnight/
│   │   ├── page.tsx             # Midnight feature overview
│   │   ├── prove/page.tsx       # Generate zero-knowledge proof
│   │   ├── transfer/page.tsx    # Transfer Midnight ownership
│   │   └── revoke/page.tsx      # Revoke Midnight record
│   ├── share/                   # Shared keepsake viewer
│   ├── guide/                   # User guide
│   └── [faq|privacy|terms]/    # Static pages
├── components/                  # Shared React components
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── LoginModal.tsx           # Email OTP + CIP-8 wallet auth
├── lib/                         # Utilities
│   ├── cardano.ts               # CIP-30 wallet helpers (connect, sign, encrypt)
│   └── useMidnightJob.ts        # React hook — polls async Midnight job status
└── public/                      # Static assets
```

## Environment Variables

```env
# WordPress REST API base URL (include /wp/v2)
NEXT_PUBLIC_WORDPRESS_API_URL=http://memorymint.local/wp-json/wp/v2

# Cardano network: "preprod" or "mainnet"
NEXT_PUBLIC_CARDANO_NETWORK=preprod
```

> **Important:** The Anvil API key lives in the WordPress plugin settings, not here.
> Never add `NEXT_PUBLIC_ANVIL_API_KEY` — it would be exposed in the browser bundle.

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Key Features

### Cardano Minting
- Connect browser wallets (Nami, Vespr, Eternl, Begin, Lace) via CIP-30
- CIP-8 challenge-response authentication — signature verified server-side
- Batch mint up to 5 keepsakes per transaction
- Custodial minting for email users (policy wallet funded by operator)

### Midnight Privacy
- Private keepsakes encrypted client-side before upload (AES-256-GCM, CEK from CIP-30 `signData`)
- Midnight registration queued automatically after Cardano mint confirms
- Zero-knowledge proof generation (ownership, content authentic, created-before, contains-tag)
- Ownership transfer and revocation — all via async job polling (`useMidnightJob`)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Cardano CIP-30](https://github.com/cardano-foundation/CIPs/blob/master/CIP-0030/)
- [Midnight Network](https://midnight.network)
- [Anvil API](https://docs.ada-anvil.app)
