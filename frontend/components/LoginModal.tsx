'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  connectWallet,
  getInstalledWallets,
  getWalletBalance,
  hexAddressToBech32,
  hexStakeAddressToBech32,
  InstalledWallet,
} from '@/lib/cardano'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (type: 'wallet' | 'email', data: any) => void
}

const WALLET_DOWNLOADS: Record<string, string> = {
  nami: 'https://namiwallet.io/',
  vespr: 'https://vespr.xyz/',
  begin: 'https://begin.is/',
  eternl: 'https://eternl.io/',
  lace: 'https://www.lace.io/',
  typhoncip30: 'https://typhonwallet.io/',
  gerowallet: 'https://gerowallet.io/',
  nufi: 'https://nu.fi/',
  yoroi: 'https://yoroi-wallet.com/',
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [loginMethod, setLoginMethod] = useState<'choose' | 'wallet' | 'email' | 'otp' | 'wallet_only'>('choose')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>([])

  useEffect(() => {
    if (isOpen) {
      setInstalledWallets(getInstalledWallets())
    }
  }, [isOpen])

  const handleWalletLogin = async (walletKey: string) => {
    setIsLoading(true)
    setError('')

    try {
      const walletApi = await connectWallet(walletKey)

      const balance = await getWalletBalance(walletApi)

      // Get payment address (CIP-30 returns hex CBOR — convert to bech32 for backend)
      const rawAddresses = await walletApi.getUsedAddresses()
      const rawAddress = rawAddresses && rawAddresses.length > 0 ? rawAddresses[0] : ''
      const isTestnet = (process.env.NEXT_PUBLIC_CARDANO_NETWORK || 'preprod') !== 'mainnet'
      const bech32Address = rawAddress ? hexAddressToBech32(rawAddress, isTestnet) : ''

      // Get stake/reward address if available (must use stake HRP, not addr HRP)
      let stakeAddress = ''
      try {
        const rewardAddrs = await walletApi.getRewardAddresses()
        if (rewardAddrs && rewardAddrs.length > 0) {
          stakeAddress = hexStakeAddressToBech32(rewardAddrs[0])
        }
      } catch { /* wallet may not support reward addresses */ }

      // CIP-8 challenge-response: fetch a server nonce, sign it, prove key ownership
      const backendBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
      const nonceRes = await fetch(
        `${backendBase}/memorymint/v1/auth/wallet-nonce?address=${encodeURIComponent(rawAddress.toLowerCase())}`
      )
      if (!nonceRes.ok) {
        throw new Error('Failed to obtain login challenge. Please try again.')
      }
      const { nonce } = await nonceRes.json()

      // signData takes the raw hex address + payload hex; returns { signature, key }
      const sigResult = await walletApi.signData(rawAddress, nonce)

      // Register with backend to get auth token
      const authRes = await fetch(`${backendBase}/memorymint/v1/auth/wallet-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: bech32Address,
          raw_address: rawAddress.toLowerCase(),
          signature: sigResult.signature,
          key: sigResult.key,
          stake_address: stakeAddress,
          wallet_name: walletKey,
        }),
      })
      const authData = await authRes.json()

      if (authRes.ok && authData.success && authData.token) {
        sessionStorage.setItem('mmToken', authData.token)
        sessionStorage.setItem('mmTokenExpiry', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
        sessionStorage.setItem('mmWalletKey', walletKey)
        sessionStorage.setItem('mmWalletAddress', bech32Address)
      }

      const shortened = bech32Address
        ? `${bech32Address.slice(0, 10)}...${bech32Address.slice(-6)}`
        : walletKey

      onSuccess('wallet', {
        walletApi,
        balance,
        address: shortened,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  const sendOtp = async () => {
    setIsLoading(true)
    setError('')
    setOtp('')
    setDebugOtp(null)

    try {
      const res = await fetch(`${apiBase}/memorymint/v1/auth/email-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.wallet_only) {
          setLoginMethod('wallet_only')
          return
        }
        setError(data.error || 'Could not send code. Please try again.')
        return
      }

      // WP_DEBUG mode: backend returns the OTP directly so local dev works
      // without a mail server. This field is never present in production.
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp)
        setOtp(data.debug_otp)  // auto-fill the input
      }

      setLoginMethod('otp')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendOtp()
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch(`${apiBase}/memorymint/v1/auth/email-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid code. Please try again.')
        return
      }

      sessionStorage.setItem('mmToken', data.token)
      sessionStorage.setItem('mmTokenExpiry', String(Date.now() + 7 * 24 * 60 * 60 * 1000))
      if (data.user?.wallet_address) {
        sessionStorage.setItem('mmWalletAddress', data.user.wallet_address)
      }

      onSuccess('email', {
        email,
        token: data.token,
        walletAddress: data.user?.wallet_address ?? null,
      })
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>Welcome back</h2>
              <p className="text-gray-600">
                Sign in securely to access your personal memory gallery.
              </p>
            </div>

            {/* Choose Method */}
            {loginMethod === 'choose' && (
              <div className="space-y-4">
                <button
                  onClick={() => setLoginMethod('wallet')}
                  className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold py-4 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  🔗 Connect Wallet
                  <p className="text-sm font-normal mt-1 opacity-80">
                    Best for full on-chain ownership
                  </p>
                </button>

                <button
                  onClick={() => setLoginMethod('email')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-4 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  ✉️ Use Email
                  <p className="text-sm font-normal mt-1 opacity-80">
                    Simple, secure login without a wallet
                  </p>
                </button>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Your memories are always under your control.
                </p>
              </div>
            )}

            {/* Wallet Login */}
            {loginMethod === 'wallet' && (
              <div>
                <button
                  onClick={() => setLoginMethod('choose')}
                  className="text-amber-600 hover:text-amber-700 mb-4 flex items-center gap-2"
                >
                  ← Back
                </button>

                {installedWallets.length > 0 ? (
                  <div className="space-y-3">
                    {installedWallets.map((wallet) => (
                      <button
                        key={wallet.key}
                        onClick={() => handleWalletLogin(wallet.key)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          {wallet.icon ? (
                            <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded-lg" />
                          ) : (
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-xs font-bold">
                              {wallet.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-gray-700">{wallet.name}</span>
                        </div>
                        <span className="text-sm text-green-600 font-medium">
                          {isLoading ? 'Connecting...' : 'Connect'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-2">No Cardano wallets detected.</p>
                    <p className="text-sm text-gray-400">Install a CIP-30 compatible wallet extension to continue.</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center mb-2">Don't have a wallet?</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {Object.entries(WALLET_DOWNLOADS).map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-600 hover:text-amber-700 hover:underline capitalize"
                      >
                        {key === 'typhoncip30' ? 'Typhon' : key === 'gerowallet' ? 'GeroWallet' : key === 'nufi' ? 'NuFi' : key.charAt(0).toUpperCase() + key.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Email Login */}
            {loginMethod === 'email' && (
              <div>
                <button
                  onClick={() => setLoginMethod('choose')}
                  className="text-amber-600 hover:text-amber-700 mb-4 flex items-center gap-2"
                >
                  ← Back
                </button>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {isLoading ? 'Sending code...' : 'Send Code'}
                  </button>
                </form>

                {error && (
                  <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <p className="text-center text-sm text-gray-500 mt-4">
                  We'll email you a 6-digit verification code.
                </p>
              </div>
            )}

            {/* Wallet-only notice — shown when email belongs to a backed-up account */}
            {loginMethod === 'wallet_only' && (
              <div className="text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Wallet login required</h3>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                  This account&apos;s seed phrase has been backed up and email login has been disabled.
                  Import your seed phrase into a Cardano wallet (Lace, Eternl, Vespr) and connect below.
                </p>
                <button
                  type="button"
                  onClick={() => setLoginMethod('wallet')}
                  className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold py-3 rounded-xl transition-all shadow-md mb-3"
                >
                  🔗 Connect Wallet
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod('choose'); setEmail('') }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            )}

            {/* OTP Verification */}
            {loginMethod === 'otp' && (
              <div>
                <button
                  onClick={() => { setLoginMethod('email'); setOtp(''); setError('') }}
                  className="text-amber-600 hover:text-amber-700 mb-4 flex items-center gap-2"
                >
                  ← Back
                </button>

                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">📬</div>
                  <p className="text-gray-700 font-medium">Check your inbox</p>
                  <p className="text-sm text-gray-500 mt-1">
                    We sent a 6-digit code to<br />
                    <span className="font-semibold text-gray-700">{email}</span>
                  </p>
                </div>

                {/* Dev-only: show OTP when WP_DEBUG is on and backend returns it */}
                {debugOtp && (
                  <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">
                      Dev Mode — Code (not sent by email)
                    </p>
                    <p className="text-3xl font-mono font-bold tracking-[0.4em] text-amber-900">
                      {debugOtp}
                    </p>
                  </div>
                )}

                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                      className="w-full text-center text-3xl tracking-[0.5em] font-mono px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => sendOtp()}
                    disabled={isLoading}
                    className="text-sm text-amber-600 hover:text-amber-700 disabled:opacity-50"
                  >
                    Didn't get the code? Resend
                  </button>
                </div>

                {error && (
                  <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
