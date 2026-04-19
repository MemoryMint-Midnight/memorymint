'use client'

import { Suspense, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface Keepsake {
  id: number
  title: string
  midnight_address: string | null
  midnight_status: string
}

function TransferPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const keepsakeId = params.get('id')

  const [keepsake, setKeepsake] = useState<Keepsake | null>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [recipient, setRecipient] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [comingSoon, setComingSoon] = useState(false)
  const [done, setDone] = useState(false)

  const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  useEffect(() => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) { router.replace('/'); return }
    if (!keepsakeId) { setLoadError('No keepsake specified.'); setIsLoading(false); return }

    fetch(`${apiBase}/memorymint/v1/keepsakes/${keepsakeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setLoadError(data.error || 'Could not load keepsake.'); return }
        setKeepsake(data.keepsake)
      })
      .catch(() => setLoadError('Network error. Please try again.'))
      .finally(() => setIsLoading(false))
  }, [keepsakeId])

  async function handleTransfer() {
    const token = sessionStorage.getItem('mmToken')
    if (!token || !keepsake || !confirmed || !recipient.trim()) return

    setIsTransferring(true)
    setTransferError('')
    setComingSoon(false)

    try {
      const res = await fetch(`${apiBase}/memorymint/v1/midnight/${keepsake.id}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: recipient.trim() }),
      })
      const data = await res.json()

      if (res.status === 404 || data.code === 'rest_no_route' || data.code === 'midnight_not_configured') {
        setComingSoon(true)
        return
      }
      if (!data.success) { setTransferError(data.error || 'Transfer failed.'); return }
      setDone(true)
    } catch {
      setTransferError('Network error. Please try again.')
    } finally {
      setIsTransferring(false)
    }
  }

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
      <p className="text-gray-500">Loading keepsake…</p>
    </div>
  )

  if (loadError) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="text-red-500 mb-4">{loadError}</p>
      <Link href="/gallery"><button type="button" className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-colors">Back to Gallery</button></Link>
    </div>
  )

  if (done) return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3 font-schoolbell">Transfer Complete</h1>
        <p className="text-gray-500 mb-8">
          <span className="font-semibold text-gray-700">{keepsake?.title}</span> has been transferred to {recipient}.
          This keepsake no longer appears in your gallery.
        </p>
        <Link href="/gallery">
          <button type="button" className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-2xl transition-all">
            Back to Gallery
          </button>
        </Link>
      </motion.div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/gallery" className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-600 transition-colors text-sm mb-8">
        ← Back to Gallery
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="text-4xl mb-3">↗️</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-schoolbell">Transfer Keepsake</h1>
        {keepsake && (
          <p className="text-gray-500 text-sm">
            Keepsake: <span className="font-semibold text-gray-700">{keepsake.title}</span>
          </p>
        )}
      </motion.div>

      {comingSoon && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6 text-center"
        >
          <div className="text-3xl mb-2">🚀</div>
          <p className="font-semibold text-indigo-800 mb-1">Midnight transfers are coming soon</p>
          <p className="text-indigo-600 text-sm">The Midnight sidecar is not yet deployed. Check back once it is live.</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <p className="font-semibold text-amber-900 mb-1">⚠ This action is permanent</p>
          <ul className="text-amber-800 text-sm space-y-1 list-disc list-inside">
            <li>Ownership on the Midnight private ledger transfers immediately</li>
            <li>The recipient gains full access to prove and manage this keepsake</li>
            <li>You will lose access to the Midnight private state</li>
            <li>The Cardano NFT ownership is <strong>not</strong> transferred automatically — handle that separately if needed</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recipient email address
            </label>
            <input
              type="email"
              value={recipient}
              onChange={e => { setRecipient(e.target.value); setTransferError('') }}
              placeholder="recipient@example.com"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p className="text-xs text-gray-400 mt-1">Must be a registered MemoryMint account.</p>
          </div>

          <label className="flex items-start gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#ffbd59]"
            />
            <span className="text-sm text-gray-700">
              I understand this is permanent and I will lose access to the Midnight private state for <strong>{keepsake?.title}</strong>
            </span>
          </label>

          {transferError && <p className="text-red-500 text-sm mb-4">{transferError}</p>}

          <button
            type="button"
            onClick={handleTransfer}
            disabled={!recipient.trim() || !confirmed || isTransferring || keepsake?.midnight_status !== 'minted'}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all"
          >
            {isTransferring ? 'Transferring…' : 'Transfer Keepsake'}
          </button>

          {keepsake?.midnight_status !== 'minted' && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Transfer is only available for keepsakes with Midnight status: minted.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <TransferPageInner />
    </Suspense>
  )
}
