# Memory Mint - Frontend

Modern Next.js frontend for Memory Mint - A blockchain-based memory preservation platform.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Cardano** - Blockchain integration via Anvil API
- **WordPress REST API** - Headless CMS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Cardano wallet (Nami, Eternl, or Lace) for testing
- WordPress backend running

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Copy .env.local and update with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with Header/Footer
│   ├── page.tsx           # Homepage
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Header.tsx         # Navigation header
│   ├── Footer.tsx         # Footer
│   └── WalletConnect.tsx  # Cardano wallet connection
├── lib/                   # Utilities and integrations
│   ├── cardano.ts         # Cardano blockchain functions
│   └── wordpress.ts       # WordPress API integration
└── public/                # Static assets
```

## Features

### Blockchain Integration

- Connect to Cardano wallets (Nami, Eternl, Lace)
- Mint memories as NFTs on testnet
- View minted memories
- Transaction verification

### WordPress Integration

- Fetch posts and pages from WordPress REST API
- Display WordPress content in modern UI
- Search functionality
- Media optimization

## Environment Variables

```env
NEXT_PUBLIC_CARDANO_NETWORK=preprod
NEXT_PUBLIC_ANVIL_API_KEY=your_anvil_api_key
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost/wp-json/wp/v2
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Cardano Documentation](https://docs.cardano.org/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)
