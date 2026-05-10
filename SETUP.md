# Memory Mint â€” Setup & Deployment Guide

## What's in this package

```
plugin/memory-mint/        WordPress plugin
frontend/                  Next.js 15 frontend (source)
config-templates/          Ready-to-use config file templates
  .env.local.example       Frontend local dev environment variables
  .env.production.example  Frontend production environment variables
  wp-config-additions.php  Lines to add to your wp-config.php
SETUP.md                   This file
```

---

## Part 1 â€” Local Testing

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Local by Flywheel | Latest | https://localwp.com |
| Node.js | 18+ | https://nodejs.org |
| PHP | 8.1+ | (bundled with Local) |

---

### 1a â€” WordPress (Local by Flywheel)

Local by Flywheel is the easiest way to run WordPress locally on Mac or Windows.

1. Download and install **Local** from https://localwp.com
2. Click **+ Create a new site**
3. Site name: `memorymint` (or anything you like)
4. Environment: **Preferred** (PHP 8.1+, MySQL 8)
5. WordPress credentials: set an admin username and password you'll remember
6. Click **Create site** â€” Local handles everything automatically
7. Note the **Site Domain** shown in Local (e.g. `memorymint.local`)

Add the following to your `wp-config.php` (Local stores it inside the site folder):

```
Local Sites/memorymint/app/public/wp-config.php
```

Open it and paste the contents of `config-templates/wp-config-additions.php`
above the `/* That's all, stop editing! */` line.

---

### 1b â€” Install the Plugin

1. Copy the `plugin/memory-mint/` folder into:
   ```
   Local Sites/memorymint/app/public/wp-content/plugins/
   ```
2. In Local, click **WP Admin** to open the WordPress dashboard
3. Go to **Plugins â†’ Installed Plugins**
4. Find **Memory Mint** and click **Activate**
5. A new **Memory Mint** menu item will appear in the sidebar

---

### 1c â€” Configure the Plugin (WP Admin)

Go to **Memory Mint â†’ Settings** and fill in:

| Setting | Value for local testing |
|---------|------------------------|
| Network | `Preprod` (testnet) |
| Anvil API Key (Preprod) | Your preprod key from https://ada-anvil.app |
| Production Frontend URL | `http://localhost:3000` |
| Merchant Wallet Address | Any preprod wallet address (receives test fees) |
| Service fees | Leave defaults or set to $0 for testing |

Get a free Anvil API key at **https://ada-anvil.app** â€” preprod keys are free.

Then go to **Memory Mint â†’ Policy Wallet**:
1. Click **Generate New Wallet**
2. **IMPORTANT:** Save the 24-word seed phrase shown â€” it will not be shown again
3. Copy the **Payment Address** and send it some preprod ADA (see faucet below)

**Preprod ADA faucet:** https://docs.cardano.org/cardano-testnets/tools/faucet/
Send at least 20 tADA to the policy wallet payment address.

---

### 1d â€” Frontend Setup

```bash
cd frontend
npm install
```

Copy the local env template:
```bash
cp ../config-templates/.env.local.example .env.local
```

Edit `.env.local` and fill in:
- `NEXT_PUBLIC_WORDPRESS_API_URL` â†’ your Local site URL + `/wp-json/wp/v2`
  e.g. `http://memorymint.local/wp-json/wp/v2`
- `NEXT_PUBLIC_ANVIL_API_KEY` â†’ your preprod Anvil key (starts with `testnet_`)

Start the dev server:
```bash
npm run dev
```

Open **http://localhost:3000** â€” you should see the Memory Mint homepage.

---

### 1e â€” Test Accounts

**Email user flow:**
1. Click **Sign In â†’ Continue with Email**
2. Enter any email address (OTP is sent via `wp_mail()`)
3. If email doesn't arrive locally, install **WP Mail SMTP** plugin and use
   a transactional mailer (Mailtrap.io works great for local testing â€” it's free)

**Wallet user flow:**
1. Install a Cardano browser wallet extension: Nami, Vespr, Eternl, Begin, or Lace
2. Create a **preprod (testnet)** wallet in the extension
3. Fund it via the faucet (link above)
4. Click **Sign In â†’ Connect Wallet** on the site

---

### 1f â€” Test a Full Mint

1. Sign in (email or wallet)
2. Go to **Mint** â†’ upload a photo, video, or audio file
3. Choose privacy level â†’ proceed to payment
4. For wallet users: approve the transaction in your browser wallet extension
5. For email users: the policy wallet funds the transaction automatically
6. Wait for minting confirmation (~30â€“60 seconds on preprod)
7. View the NFT on **https://preprod.cardanoscan.io**

---

## Part 2 â€” Production Deployment

### Server Requirements

**WordPress (backend):**
- PHP 8.1+ with `sodium` extension (bundled with PHP 8.x)
- MySQL 8.0+ or MariaDB 10.6+
- HTTPS (SSL certificate required)
- WordPress 6.4+

**Next.js (frontend):**
Option A â€” **Vercel** (recommended, zero-config)
Option B â€” **Self-hosted VPS** (Node.js 18+, nginx/caddy as reverse proxy)

---

### 2a â€” WordPress Hosting

Any managed WordPress host works (WP Engine, Kinsta, Cloudways, etc.)
or a self-managed VPS with Nginx + PHP-FPM.

1. Install WordPress on your domain
2. Copy `plugin/memory-mint/` to `wp-content/plugins/`
3. Activate the plugin in WP Admin â†’ Plugins
4. Open `wp-config.php` on the server and add the lines from
   `config-templates/wp-config-additions.php`
5. Configure the plugin (see settings table below)

**WP Admin â†’ Memory Mint â†’ Settings (production values):**

| Setting | Value |
|---------|-------|
| Network | `Mainnet` |
| Anvil API Key (Mainnet) | Your mainnet key from https://ada-anvil.app |
| Production Frontend URL | `https://your-frontend-domain.com` |
| Merchant Wallet Address | Your real Cardano mainnet wallet address |

**WP Admin â†’ Memory Mint â†’ Policy Wallet:**
1. Generate a mainnet policy wallet
2. Save the seed phrase in a secure password manager (1Password, Bitwarden, etc.)
3. Fund the wallet â€” **minimum 20 ADA recommended**
   Each custodial mint (email user) consumes ~2.2 ADA from this wallet

---

### 2b â€” Frontend Deployment on Vercel (Recommended)

1. Push the `frontend/` directory to a GitHub/GitLab repository
2. Import the repo at **https://vercel.com/new**
3. Framework preset: **Next.js** (auto-detected)
4. Set environment variables in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_WORDPRESS_API_URL` | `https://your-wp-domain.com/wp-json/wp/v2` |
| `NEXT_PUBLIC_CARDANO_NETWORK` | `mainnet` |
| `COMING_SOON` | `false` |
| `COMING_SOON_BYPASS` | `mmpreview` |

> **Note:** The Anvil API key is stored in the WordPress plugin settings, not the frontend environment. Do not add `NEXT_PUBLIC_ANVIL_API_KEY` — it would be exposed in the browser bundle.

5. Click **Deploy** â€” Vercel builds and deploys automatically
6. Assign your custom domain in Vercel â†’ Project â†’ Settings â†’ Domains

---

### 2c â€” Frontend Deployment (Self-hosted VPS)

```bash
cd frontend

# Copy and fill in production env
cp ../config-templates/.env.production.example .env.production
nano .env.production   # fill in all values

# Build
npm install
npm run build

# Run with PM2 (keeps the process alive)
npm install -g pm2
pm2 start npm --name "memorymint" -- start
pm2 save
pm2 startup
```

Nginx reverse proxy config:
```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-frontend-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-frontend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-frontend-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

SSL via Let's Encrypt: `sudo certbot --nginx -d your-frontend-domain.com`

---

### 2d — Midnight Sidecar (Required for Private Keepsakes)

The Midnight sidecar is a separate Node.js service that handles privacy proofs. It must run alongside WordPress for private keepsake minting, proving, transferring, and revoking.

**Requirements:**
- Node.js 18+
- Docker (to run the Midnight proof server)
- A dedicated Midnight testnet/mainnet wallet with DUST tokens

**Setup:**
```bash
cd midnight/service
cp ../.env.example .env
nano .env   # fill in all values (see midnight/.env.example)
npm install
npm run build
```

Start the Midnight proof server (Docker):
```bash
docker run -d --name proof-server -p 6300:6300 midnightntwrk/proof-server:8.0.3
```

Start the sidecar:
```bash
# With PM2 (recommended for production)
pm2 start npm --name “memorymint-midnight” -- start
pm2 save

# Or directly
npm start
```

**System cron for async Midnight jobs (PRODUCTION REQUIRED):**

Add to `/etc/cron.d/memorymint`:
```
* * * * * www-data wp cron event run --due-now --path=/var/www/html >> /var/log/wp-cron.log 2>&1
```

And add to `wp-config.php`:
```php
define( ‘DISABLE_WP_CRON’, true );
```

This prevents Nginx’s `fastcgi_read_timeout` (60s) from killing Midnight operations that take 8–15 minutes. See `config-templates/wp-config-additions.php` for the full snippet.

---

### 2e — Post-Deployment Checklist

**WordPress & Frontend:**
- [ ] HTTPS works on both WordPress and frontend domains
- [ ] Set WordPress Home URL and Site URL to `https://` in WP Admin → Settings → General
- [ ] Memory Mint → Settings → Production Frontend URL is set to your `https://` frontend domain
- [ ] Anvil API key is set to the **mainnet** key (in WordPress plugin settings, not frontend env)
- [ ] Network is set to **Mainnet** in Memory Mint Settings
- [ ] PHP `sodium` extension available (`php -m | grep sodium`) — required for wallet auth
- [ ] Policy wallet is generated and funded (≥20 ADA)
- [ ] Install an SMTP plugin (WP Mail SMTP) and configure a transactional mailer
- [ ] Memory Mint → Settings → Send Test Email confirms mail delivery
- [ ] `DISABLE_WP_CRON=true` in wp-config.php and system cron running (see 2d above)

**Midnight sidecar:**
- [ ] Midnight proof server Docker container running on port 6300
- [ ] Sidecar running and healthy: `curl https://your-midnight-domain.com/health`
- [ ] `dustBalance` in health response is non-zero (sidecar wallet funded with DUST)
- [ ] `MIDNIGHT_API_SECRET` matches between sidecar `.env` and WordPress plugin settings
- [ ] `CORS_ALLOWED_ORIGINS` set to your frontend domain in sidecar `.env`

**End-to-end tests:**
- [ ] Do one mint on mainnet — email user + wallet user
- [ ] Confirm NFT appears on https://cardanoscan.io
- [ ] Confirm share invitation email arrives with correct `https://` links
- [ ] Mint one private keepsake and confirm Midnight status shows “minted” in gallery within 15 min

---

## Part 3 â€” Reference

### WordPress REST API Endpoints

Base URL: `{WORDPRESS_URL}/wp-json/memorymint/v1/`

**Auth**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/wallet-nonce` | Get one-time nonce for CIP-8 wallet auth |
| POST | `/auth/wallet-connect` | Authenticate wallet user (requires CIP-8 signature) |
| POST | `/auth/register` | Register email user |
| POST | `/auth/verify-otp` | Verify OTP and get auth token |
| POST | `/auth/refresh` | Refresh auth token |
| POST | `/auth/logout` | Invalidate token |
| DELETE | `/auth/delete-account` | Delete account |
| POST | `/auth/seed-phrase-otp` | Send OTP for seed phrase step-up auth |
| GET | `/auth/seed-phrase` | Retrieve mnemonic (requires `?otp=` param) |

**Mint**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload media file |
| POST | `/keepsakes` | Create keepsake record |
| GET | `/keepsakes` | List user's keepsakes |
| GET | `/keepsakes/{id}` | Get single keepsake |
| POST | `/mint/build` | Build unsigned Cardano transaction |
| POST | `/mint/sign` | Submit wallet-signed transaction |
| POST | `/mint/custodial-sign` | Submit custodial (email user) transaction |
| POST | `/mint/retry/{id}` | Reset a failed keepsake for retry |
| GET | `/mint/status/{tx_hash}` | Poll Cardano transaction status |
| GET | `/mint/price` | Get current service fees + ADA price |
| POST | `/mint/midnight/{id}` | Queue Midnight registration after Cardano mint |

**Gallery & Sharing**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gallery` | Get user's minted gallery |
| GET | `/memories` | Get public memory feed |
| POST | `/share` | Create share token |
| GET | `/share/{token}` | Get shared keepsake |
| GET | `/albums` | List user's albums |
| POST | `/albums` | Create album |
| POST | `/albums/{id}/keepsakes` | Add keepsakes to album |

**Midnight (Private Keepsakes)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/midnight/{id}/prove` | Queue zero-knowledge proof generation |
| POST | `/midnight/{id}/transfer` | Queue Midnight ownership transfer |
| POST | `/midnight/{id}/revoke` | Queue Midnight record revocation |
| GET | `/midnight/{id}/status` | Get current Midnight status for a keepsake |
| GET | `/midnight/job/{job_id}` | Poll async job result (prove/transfer/revoke) |

### Supported Cardano Wallets
Nami, Vespr, Begin, Eternl, Lace

### File Upload Limits (configurable in Settings)
| Type | Default max |
|------|------------|
| Image (JPG, PNG, WEBP, HEIC) | 10 MB |
| Video (MP4, MOV, WEBM) | 50 MB |
| Audio (MP3, M4A, WAV) | 10 MB |

Max 5 files per mint transaction.

### Privacy Levels
| Level | Who can view |
|-------|-------------|
| Public | Anyone via /memories feed |
| Shared | Anyone with the share link |
| Private | Owner only (Midnight privacy protocol — requires Midnight sidecar deployed) |

### Useful Links
- Anvil API docs: https://docs.ada-anvil.app
- Cardano preprod explorer: https://preprod.cardanoscan.io
- Cardano mainnet explorer: https://cardanoscan.io
- Preprod ADA faucet: https://docs.cardano.org/cardano-testnets/tools/faucet/
- Local by Flywheel: https://localwp.com
- WP Mail SMTP: https://wordpress.org/plugins/wp-mail-smtp/
- Mailtrap (local email testing): https://mailtrap.io
