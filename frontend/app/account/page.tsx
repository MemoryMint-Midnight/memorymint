'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SeedPhraseModal from '@/components/SeedPhraseModal'

interface UserProfile {
  id: number
  email: string
  display_name: string
  wallet_address: string | null
  stake_address: string | null
  wallet_name: string | null
  auth_method: string
  roles: string[]
  registered: string
  needs_seed_backup: boolean
  is_custodial: boolean
}

const ROLE_LABELS: Record<string, string> = {
  memory_founder: 'Founder',
  memory_collector: 'Collector',
  keepsake_owner: 'Keepsake Owner',
  subscriber: 'Standard',
  administrator: 'Admin',
}

const WALLET_LABELS: Record<string, string> = {
  nami: 'Nami',
  vespr: 'Vespr',
  begin: 'Begin',
  eternl: 'Eternl',
  lace: 'Lace',
  typhon: 'Typhon',
  nufi: 'NuFi',
  gerowallet: 'GeroWallet',
  yoroi: 'Yoroi',
}

function displayRole(roles: string[]): string {
  for (const r of ['administrator', 'memory_founder', 'memory_collector', 'keepsake_owner', 'subscriber']) {
    if (roles.includes(r)) return ROLE_LABELS[r] ?? r
  }
  return 'Standard'
}

function shortAddress(addr: string): string {
  if (addr.length <= 20) return addr
  return addr.slice(0, 12) + '…' + addr.slice(-6)
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [keepsakeCount, setKeepsakeCount] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteInputRef = useRef<HTMLInputElement>(null)

  const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  useEffect(() => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) {
      router.replace('/')
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`${apiBase}/memorymint/v1/auth/me`, { headers }).then(r => r.json()),
      fetch(`${apiBase}/memorymint/v1/mint/wallet-balance`, { headers }).then(r => r.json()).catch(() => null),
    ])
      .then(([profileData, balanceData]) => {
        if (!profileData.success) {
          setError('Session expired. Please log in again.')
          return
        }
        setUser(profileData.user)
        setKeepsakeCount(profileData.keepsake_count ?? 0)
        if (balanceData?.success && typeof balanceData.balance_ada === 'number') {
          setWalletBalance(balanceData.balance_ada)
        }
      })
      .catch(() => setError('Could not load your profile. Please try again.'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleExport = async () => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    setIsExporting(true)
    try {
      const res = await fetch(`${apiBase}/memorymint/v1/auth/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memorymint-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`${apiBase}/memorymint/v1/auth/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) {
        setDeleteError(data.error || 'Deletion failed. Please try again.')
        setIsDeleting(false)
        return
      }
      // Clear session and redirect
      sessionStorage.clear()
      router.replace('/?account=deleted')
    } catch {
      setDeleteError('Could not reach the server. Please try again.')
      setIsDeleting(false)
    }
  }

  const handleCopyAddress = () => {
    if (!user?.wallet_address) return
    navigator.clipboard?.writeText(user.wallet_address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    const token = sessionStorage.getItem('mmToken')
    if (token) {
      fetch(`${apiBase}/memorymint/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    sessionStorage.removeItem('userEmail')
    sessionStorage.removeItem('walletConnected')
    sessionStorage.removeItem('mmToken')
    sessionStorage.removeItem('mmTokenExpiry')
    sessionStorage.removeItem('mmWalletAddress')
    sessionStorage.removeItem('mmWalletKey')
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
        <p className="text-gray-500">Loading your profile…</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-500 mb-4">{error || 'Something went wrong.'}</p>
        <Link href="/">
          <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-colors">
            Go Home
          </button>
        </Link>
      </div>
    )
  }

  const initials = user.display_name
    ? user.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email.slice(0, 2).toUpperCase()

  const memberSince = new Date(user.registered).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const isEmailUser = user.auth_method === 'email' || user.is_custodial
  const walletLabel = user.wallet_name ? (WALLET_LABELS[user.wallet_name.toLowerCase()] ?? user.wallet_name) : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Back link */}
      <Link href="/gallery" className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-600 transition-colors text-sm mb-8">
        ← Back to Gallery
      </Link>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="w-20 h-20 rounded-full bg-mint-gold flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            {initials}
          </span>
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-1" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          {user.display_name || user.email}
        </h1>
        <p className="text-gray-500 text-sm">Member since {memberSince}</p>
      </motion.div>

      {/* Seed phrase backup warning */}
      {user.needs_seed_backup && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-6"
        >
          <p className="font-semibold text-amber-900 mb-1">⚠ Back up your seed phrase</p>
          <p className="text-amber-700 text-sm mb-3">
            Your wallet&apos;s seed phrase is stored temporarily on our servers. Back it up now —
            after backup you&apos;ll log in with your Cardano wallet instead of email.
          </p>
          <button
            type="button"
            onClick={() => setShowSeedModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
          >
            Back Up Now
          </button>
        </motion.div>
      )}

      <div className="space-y-4">
        {/* Account Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Account Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-800 font-medium">{user.email.includes('@wallet.memorymint') ? '—' : user.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Login method</span>
              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 font-medium px-3 py-1 rounded-full">
                {isEmailUser ? '📧 Email' : `🔗 ${walletLabel ?? 'Cardano Wallet'}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Account type</span>
              <span className="inline-flex items-center gap-1.5 bg-mint-yellow text-gray-700 font-medium px-3 py-1 rounded-full">
                {displayRole(user.roles)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Wallet */}
        {user.wallet_address && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontFamily: "'Grape Nuts', cursive" }}>
              {isEmailUser ? 'Custodial Wallet' : 'Connected Wallet'}
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500 shrink-0">Address</span>
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-gray-700 text-xs bg-gray-50 px-2 py-1 rounded-lg truncate max-w-[180px] sm:max-w-xs">
                    {shortAddress(user.wallet_address)}
                  </code>
                  <button
                    onClick={handleCopyAddress}
                    className="shrink-0 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              {isEmailUser && walletBalance !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Balance</span>
                  <span className={`font-semibold ${walletBalance >= 5 ? 'text-green-600' : walletBalance >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
                    {walletBalance.toFixed(2)} ADA
                  </span>
                </div>
              )}
              {isEmailUser && user.stake_address && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 shrink-0">Stake address</span>
                  <code className="text-gray-500 text-xs bg-gray-50 px-2 py-1 rounded-lg truncate max-w-[180px] sm:max-w-xs">
                    {shortAddress(user.stake_address)}
                  </code>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Your Stats
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Keepsakes minted</span>
            <span className="text-3xl font-bold text-amber-600" style={{ fontFamily: "'Grape Nuts', cursive" }}>
              {keepsakeCount ?? 0}
            </span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link href="/gallery" className="flex-1">
            <button className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-2xl shadow-md transition-all">
              My Gallery
            </button>
          </Link>
          <Link href="/mint" className="flex-1">
            <button className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-2xl shadow-md border-2 border-gray-200 transition-all">
              Mint a Memory
            </button>
          </Link>
        </motion.div>

        {/* Export + Logout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-1 pt-2"
        >
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="text-gray-400 hover:text-amber-600 text-sm font-medium py-2 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Preparing download…' : '↓ Download my data'}
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 text-sm font-medium py-2 transition-colors"
          >
            Sign out
          </button>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError('') }}
            className="text-gray-300 hover:text-red-400 text-xs font-medium py-1 transition-colors"
          >
            Delete account
          </button>
        </motion.div>
      </div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
            >
              <div className="text-4xl mb-4 text-center">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                Delete Your Account
              </h2>
              <p className="text-gray-600 text-sm text-center mb-6">
                This is permanent and cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 space-y-1 text-sm text-red-700">
                <p className="font-semibold mb-2">What will be deleted:</p>
                <p>✕ Your account and login credentials</p>
                <p>✕ All keepsake records and uploaded media files</p>
                <p>✕ All albums</p>
                <p>✕ Your custodial wallet (if applicable)</p>
                <p className="font-semibold mt-3 text-red-600">What cannot be deleted:</p>
                <p>⛓ On-chain blockchain records — these are permanent by design</p>
              </div>

              <p className="text-gray-600 text-sm mb-3">
                Type <strong>DELETE</strong> to confirm:
              </p>
              <input
                ref={deleteInputRef}
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && deleteConfirmText === 'DELETE' && handleDeleteAccount()}
                placeholder="DELETE"
                className="w-full border-2 border-gray-200 focus:border-red-400 focus:outline-none rounded-xl px-4 py-3 text-gray-800 font-mono mb-4"
                autoFocus
              />

              {deleteError && (
                <p className="text-red-500 text-sm mb-4">{deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SeedPhraseModal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        onComplete={() => {
          setShowSeedModal(false)
          setUser((prev) => prev ? { ...prev, needs_seed_backup: false } : prev)
        }}
      />
    </div>
  )
}
