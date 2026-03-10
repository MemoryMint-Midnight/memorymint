'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  connectWallet,
  getAvailableWallets,
  getWalletBalance,
  isCardanoWalletAvailable,
  type CardanoWallet,
} from '@/lib/cardano'

export default function WalletConnect() {
  const [walletApi, setWalletApi] = useState<any>(null)
  const [balance, setBalance] = useState<string>('0')
  const [address, setAddress] = useState<string>('')
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [availableWallets, setAvailableWallets] = useState<CardanoWallet[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Show all supported wallets — installed ones for connecting, others for download
    const wallets = getAvailableWallets()
    setAvailableWallets(wallets)
  }, [])

  useEffect(() => {
    if (!walletApi) return

    // Fetch immediately on connect, then refresh every 30 seconds
    updateWalletInfo()
    const interval = setInterval(updateWalletInfo, 30_000)
    return () => clearInterval(interval)
  }, [walletApi])

  const updateWalletInfo = async () => {
    if (!walletApi) return

    try {
      const bal = await getWalletBalance(walletApi)
      setBalance(bal)

      const addresses = await walletApi.getUsedAddresses()
      if (addresses && addresses.length > 0) {
        // Shorten address for display
        const addr = addresses[0]
        const shortened = `${addr.slice(0, 8)}...${addr.slice(-8)}`
        setAddress(shortened)
      }
    } catch (err) {
      console.error('Wallet connection lost:', err)
      // CIP-30 throws when the user revokes access — auto-disconnect cleanly
      setWalletApi(null)
      setBalance('0')
      setAddress('')
      setError('Wallet disconnected. Please reconnect.')
    }
  }

  const handleConnectWallet = async (walletName: string) => {
    setIsLoading(true)
    setError('')

    try {
      const api = await connectWallet(walletName.toLowerCase())
      setWalletApi(api)
      setShowWalletMenu(false)
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
      console.error('Wallet connection error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    setWalletApi(null)
    setBalance('0')
    setAddress('')
  }

  // If wallet is connected, show balance and address
  if (walletApi) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 bg-white/50 rounded-xl px-4 py-2">
          <span className="text-sm font-medium text-gray-700">{balance} ₳</span>
          <span className="text-xs text-gray-500">{address}</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDisconnect}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Disconnect
        </motion.button>
      </div>
    )
  }

  // Show connect button with wallet selection (if no wallets installed, button will still show)
  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowWalletMenu(!showWalletMenu)}
        disabled={isLoading}
        className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Connecting...' : 'Connect Wallet'}
      </motion.button>

      {/* Wallet Selection Menu */}
      <AnimatePresence>
        {showWalletMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
          >
            <div className="p-2">
              <p className="text-xs text-gray-500 px-3 py-2 font-medium">
                Select a wallet:
              </p>
              {availableWallets.map((wallet) =>
                wallet.installed ? (
                  <button
                    key={wallet.key}
                    onClick={() => handleConnectWallet(wallet.key)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded-full" />
                    <span className="font-medium text-gray-700">{wallet.name}</span>
                  </button>
                ) : (
                  <a
                    key={wallet.key}
                    href={wallet.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left opacity-60"
                  >
                    <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded-full" />
                    <span className="font-medium text-gray-500">{wallet.name}</span>
                    <span className="ml-auto text-xs text-blue-500">Install</span>
                  </a>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="absolute right-0 mt-2 w-64 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
