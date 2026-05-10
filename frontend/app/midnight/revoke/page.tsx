'use client'

import { Suspense, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMidnightJob } from '@/lib/useMidnightJob'

interface Keepsake {
  id: number
  title: string
  midnight_address: string | null
  midnight_status: string
}

const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

function RevokePageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const keepsakeId = params.get('id')

  const [keepsake, setKeepsake]     = useState<Keepsake | null>(null)
  const [loadError, setLoadError]   = useState('')
  const [isLoading, setIsLoading]   = useState(true)

  const [confirmText, setConfirmText] = useState('')
  const [isRevoking, setIsRevoking]   = useState(false)
  const [revokeError, setRevokeError] = useState('')
  const [comingSoon, setComingSoon]   = useState(false)
  const [done, setDone]               = useState(false)

  // Async job polling
  const [jobId, setJobId] = useState<string | null>(null)
  const jobStatus = useMidnightJob(apiBase, jobId)

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
  }, [keepsakeId, router])

  // React to job completion
  useEffect(() => {
    if (!jobStatus.status) return
    if (jobStatus.status === 'done') {
      setIsRevoking(false)
      setJobId(null)
      setDone(true)
    } else if (jobStatus.status === 'failed') {
      setRevokeError(jobStatus.error || 'Revoke failed.')
      setIsRevoking(false)
      setJobId(null)
    }
  }, [jobStatus])

  async function handleRevoke() {
    const token = sessionStorage.getItem('mmToken')
    if (!token || !keepsake || confirmText !== 'REVOKE') return

    setIsRevoking(true)
    setRevokeError('')
    setComingSoon(false)

    try {
      const res  = await fetch(`${apiBase}/memorymint/v1/midnight/${keepsake.id}/revoke`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.status === 404 || data.code === 'rest_no_route' || data.code === 'midnight_not_configured') {
        setComingSoon(true)
        setIsRevoking(false)
        return
      }

      // Async path — job queued, keep isRevoking=true and start polling
      if (res.status === 202 && data.queued) {
        setJobId(data.job_id)
        return
      }

      if (!data.success) {
        setRevokeError(data.error || 'Revoke failed.')
        setIsRevoking(false)
        return
      }

      // Synchronous fallback
      setIsRevoking(false)
      setDone(true)
    } catch {
      setRevokeError('Network error. Please try again.')
      setIsRevoking(false)
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
        <div className="text-5xl mb-4">🗑</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3 font-schoolbell">Keepsake Revoked</h1>
        <p className="text-gray-500 mb-8">
          The Midnight private record for <span className="font-semibold text-gray-700">{keepsake?.title}</span> has been permanently revoked.
          No further proofs can be generated.
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
        <div className="text-4xl mb-3">🗑</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-schoolbell">Revoke Keepsake</h1>
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
          <p className="font-semibold text-indigo-800 mb-1">Midnight revocation is coming soon</p>
          <p className="text-indigo-600 text-sm">The Midnight sidecar is not yet deployed. Check back once it is live.</p>
        </motion.div>
      )}

      {/* Polling progress banner */}
      {jobId && jobStatus.status && jobStatus.status !== 'done' && jobStatus.status !== 'failed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-start gap-4"
        >
          <div className="text-2xl animate-spin mt-0.5">⚙️</div>
          <div>
            <p className="font-semibold text-red-900">Revocation in progress…</p>
            <p className="text-red-700 text-sm mt-1">
              The Midnight network is processing your revocation. This may take up to 15 minutes.
              Keep this tab open — the page will update automatically when complete.
            </p>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6">
          <p className="font-semibold text-red-900 mb-2">⛔ This action cannot be undone</p>
          <ul className="text-red-800 text-sm space-y-1 list-disc list-inside">
            <li>The Midnight private ledger record is permanently revoked</li>
            <li>No further zero-knowledge proofs can be generated for this keepsake</li>
            <li>The Cardano NFT is <strong>not</strong> burned — it stays in your wallet as a record</li>
            <li>You cannot undo this even if you still hold the Cardano NFT</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <label htmlFor="revoke-confirm" className="block text-gray-700 text-sm mb-4">
            Type <strong>REVOKE</strong> to confirm you want to permanently revoke the Midnight record for{' '}
            <span className="font-semibold">{keepsake?.title}</span>:
          </label>

          <input
            id="revoke-confirm"
            type="text"
            value={confirmText}
            onChange={e => { setConfirmText(e.target.value.toUpperCase()); setRevokeError('') }}
            onKeyDown={e => e.key === 'Enter' && confirmText === 'REVOKE' && handleRevoke()}
            placeholder="REVOKE"
            autoComplete="off"
            className="w-full border-2 border-gray-200 focus:border-red-400 focus:outline-none rounded-2xl px-4 py-3 text-gray-800 font-mono mb-6 transition-colors"
          />

          {revokeError && <p className="text-red-500 text-sm mb-4">{revokeError}</p>}

          <button
            type="button"
            onClick={handleRevoke}
            disabled={confirmText !== 'REVOKE' || isRevoking || keepsake?.midnight_status !== 'minted'}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all"
          >
            {isRevoking ? 'Revoking…' : 'Permanently Revoke'}
          </button>

          {keepsake?.midnight_status !== 'minted' && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Revocation is only available for keepsakes with Midnight status: minted.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function RevokePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <RevokePageInner />
    </Suspense>
  )
}
