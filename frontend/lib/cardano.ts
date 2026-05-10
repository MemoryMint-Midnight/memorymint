/**
 * Cardano Blockchain Integration
 */

const CARDANO_NETWORK = process.env.NEXT_PUBLIC_CARDANO_NETWORK || 'preprod'
export const EXPLORER_BASE = CARDANO_NETWORK === 'mainnet'
  ? 'https://cardanoscan.io'
  : 'https://preprod.cardanoscan.io'

export interface CardanoWallet {
  key: string       // CIP-30 key used in window.cardano (e.g. 'begin', not 'Begin Wallet')
  name: string
  icon: string
  apiVersion: string
  enable: () => Promise<any>
  isEnabled: () => Promise<boolean>
  installed: boolean
  downloadUrl: string
}

export interface InstalledWallet {
  key: string
  name: string
  icon: string | null
}

/**
 * Dynamically detect all installed CIP-30 wallets from window.cardano
 * (mirrors WeldPress approach — no hardcoded list needed)
 */
export const getInstalledWallets = (): InstalledWallet[] => {
  if (typeof window === 'undefined') return []
  const cardano = (window as any).cardano
  if (!cardano) return []

  return Object.keys(cardano)
    .filter((key) => {
      const w = cardano[key]
      return w && typeof w.enable === 'function' && key !== 'enable' && key !== '_events'
    })
    .map((key) => ({
      key,
      name: (cardano[key].name as string) || key,
      icon: (cardano[key].icon as string) || null,
    }))
}

/**
 * Check if Cardano wallet is available
 */
export const isCardanoWalletAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!(window as any).cardano
}

// Brand colors and fallback letter-avatar icons for known wallets.
// Shown when a wallet isn't installed or its CIP-30 object provides no icon.
const WALLET_BRAND_COLORS: Record<string, string> = {
  nami:   '#349EA3',
  vespr:  '#6C47FF',
  begin:  '#00BFFF',
  eternl: '#1B4F8A',
  lace:   '#E5007D',
}

function makeWalletFallbackIcon(letter: string, bgColor: string): string {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<circle cx="24" cy="24" r="24" fill="${bgColor}"/>` +
    `<text x="24" y="32" text-anchor="middle" font-family="sans-serif" ` +
    `font-size="24" font-weight="700" fill="white">${letter.toUpperCase()}</text>` +
    `</svg>`
  )
  return `data:image/svg+xml,${svg}`
}

/**
 * Get list of all supported Cardano wallets (both installed and not installed).
 * Non-installed wallets are included so the UI can show download links.
 * All wallets have a fallback icon so the UI never shows a broken image or '?'.
 */
export const getAvailableWallets = (): CardanoWallet[] => {
  if (typeof window === 'undefined') return []

  const cardano = (window as any).cardano

  // All supported wallets with their download URLs
  const supportedWallets = [
    { key: 'nami',   name: 'Nami',         downloadUrl: 'https://namiwallet.io/' },
    { key: 'vespr',  name: 'Vespr',         downloadUrl: 'https://vespr.xyz/' },
    { key: 'begin',  name: 'Begin Wallet',  downloadUrl: 'https://begin.is/' },
    { key: 'eternl', name: 'Eternl',        downloadUrl: 'https://eternl.io/' },
    { key: 'lace',   name: 'Lace',          downloadUrl: 'https://www.lace.io/' },
  ]

  const wallets: CardanoWallet[] = supportedWallets.map((wallet) => {
    const isInstalled = !!(cardano && cardano[wallet.key])
    const fallback = makeWalletFallbackIcon(
      wallet.name[0],
      WALLET_BRAND_COLORS[wallet.key] ?? '#888888'
    )

    return {
      key: wallet.key,
      name: wallet.name,
      icon: isInstalled ? (cardano[wallet.key].icon || fallback) : fallback,
      apiVersion: isInstalled ? (cardano[wallet.key].apiVersion || '0.1.0') : '0.1.0',
      enable: isInstalled ? cardano[wallet.key].enable.bind(cardano[wallet.key]) : async () => {},
      isEnabled: isInstalled ? cardano[wallet.key].isEnabled.bind(cardano[wallet.key]) : async () => false,
      installed: isInstalled,
      downloadUrl: wallet.downloadUrl,
    }
  })

  // Sort: installed wallets first, then non-installed
  return wallets.sort((a, b) => {
    if (a.installed && !b.installed) return -1
    if (!a.installed && b.installed) return 1
    return 0
  })
}

/**
 * Connect to a Cardano wallet
 */
export const connectWallet = async (walletName: string = 'nami'): Promise<any> => {
  try {
    if (typeof window === 'undefined') {
      throw new Error('Window is not defined')
    }

    const cardano = (window as any).cardano
    if (!cardano || !cardano[walletName.toLowerCase()]) {
      throw new Error(`${walletName} wallet not found. Please install it first.`)
    }

    const api = await cardano[walletName.toLowerCase()].enable()
    return api
  } catch (error) {
    console.error('Error connecting to wallet:', error)
    throw error
  }
}

/**
 * Sign an arbitrary message via CIP-30 signData and return the raw signature hex.
 * Used as IKM for HKDF key derivation (content encryption/decryption).
 */
export async function signDataForKey(
  walletApi: any,
  addressHex: string,
  message: string,
): Promise<string> {
  const payloadHex = Array.from(new TextEncoder().encode(message))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const result = await walletApi.signData(addressHex, payloadHex)
  return result.signature as string
}

/**
 * Get wallet balance
 */
export const getWalletBalance = async (walletApi: any): Promise<string> => {
  try {
    const balance = await walletApi.getBalance()
    // Convert lovelace to ADA (1 ADA = 1,000,000 lovelace)
    const ada = parseInt(balance) / 1_000_000
    return ada.toFixed(2)
  } catch (error) {
    console.error('Error getting wallet balance:', error)
    throw error
  }
}

/**
 * Get wallet address
 */
export const getWalletAddress = async (walletApi: any): Promise<string> => {
  try {
    const addresses = await walletApi.getUsedAddresses()
    if (addresses && addresses.length > 0) {
      return addresses[0]
    }
    const unusedAddresses = await walletApi.getUnusedAddresses()
    return unusedAddresses[0] || ''
  } catch (error) {
    console.error('Error getting wallet address:', error)
    throw error
  }
}


// ---- Bech32 utilities for address decoding ----------------------------------

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

function bech32Polymod(values: number[]): number {
  let chk = 1
  for (const v of values) {
    const b = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; ++i) if ((b >> i) & 1) chk ^= BECH32_GENERATOR[i]
  }
  return chk
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = []
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) >> 5)
  ret.push(0)
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) & 31)
  return ret
}

function bech32Checksum(hrp: string, data: number[]): number[] {
  const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0])
  const poly = bech32Polymod(values) ^ 1
  return Array.from({ length: 6 }, (_, i) => (poly >> (5 * (5 - i))) & 31)
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0, bits = 0
  const ret: number[] = []
  const maxv = (1 << to) - 1
  for (const v of data) {
    acc = (acc << from) | v
    bits += from
    while (bits >= to) { bits -= to; ret.push((acc >> bits) & maxv) }
  }
  if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv)
  return ret
}

/**
 * Convert a CIP-30 hex address (CBOR-encoded Shelley) to bech32.
 * If the address is already bech32 (starts with "addr"), returns it unchanged.
 */
export function hexAddressToBech32(hexOrBech32: string, testnet = true): string {
  if (!hexOrBech32) return hexOrBech32
  if (hexOrBech32.startsWith('addr')) return hexOrBech32 // already bech32
  try {
    const bytes = hexOrBech32.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    const headerByte = bytes[0]
    const isTestnet = (headerByte & 1) === 0
    const hrp = isTestnet ? 'addr_test' : 'addr'
    const data5 = convertBits(bytes, 8, 5, true)
    const checksum = bech32Checksum(hrp, data5)
    return hrp + '1' + [...data5, ...checksum].map((d) => BECH32_CHARSET[d]).join('')
  } catch {
    return hexOrBech32 // return as-is on error
  }
}

/**
 * Convert a CIP-30 hex reward address (CBOR-encoded) to bech32 stake address.
 * Stake addresses use 'stake_test' (testnet) or 'stake' (mainnet) as HRP —
 * NOT 'addr_test'/'addr'. If already starts with 'stake', returns it unchanged.
 */
export function hexStakeAddressToBech32(hexOrBech32: string): string {
  if (!hexOrBech32) return hexOrBech32
  if (hexOrBech32.startsWith('stake')) return hexOrBech32 // already bech32
  try {
    const bytes = hexOrBech32.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    const headerByte = bytes[0]
    const isTestnet = (headerByte & 1) === 0
    const hrp = isTestnet ? 'stake_test' : 'stake'
    const data5 = convertBits(bytes, 8, 5, true)
    const checksum = bech32Checksum(hrp, data5)
    return hrp + '1' + [...data5, ...checksum].map((d) => BECH32_CHARSET[d]).join('')
  } catch {
    return hexOrBech32
  }
}

/**
 * Get the stake/reward address from a connected CIP-30 wallet.
 * Returns bech32 stake address (stake_test1... or stake1...) or null if unavailable.
 */
export const getStakeAddress = async (walletApi: any): Promise<string | null> => {
  try {
    const rewardAddresses = await walletApi.getRewardAddresses()
    if (!rewardAddresses || rewardAddresses.length === 0) return null
    return hexStakeAddressToBech32(rewardAddresses[0])
  } catch {
    return null
  }
}

