'use client'

import { Suspense, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMidnightJob } from '@/lib/useMidnightJob'

type ProofType = 'ownership' | 'content_authentic' | 'created_before' | 'contains_tag'

interface Keepsake {
  id: number
  title: string
  midnight_address: string | null
  midnight_status: string
}

interface ProofResult {
  verified: boolean
  proof_type: ProofType
  tx_id: string
  proved_at: string
}

const PROOF_OPTIONS: { value: ProofType; label: string; description: string; icon: string }[] = [
  { value: 'ownership',         label: 'Ownership',         icon: '🔑', description: 'Prove this memory belongs to you without revealing your identity.' },
  { value: 'content_authentic', label: 'Content Authentic', icon: '✅', description: 'Prove the content has never been altered since it was minted.' },
  { value: 'created_before',    label: 'Created Before',    icon: '📅', description: 'Prove this memory existed before a specific date.' },
  { value: 'contains_tag',      label: 'Contains Tag',      icon: '🏷', description: 'Prove this memory has at least one person tag without revealing who.' },
]

const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

function ProvePageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const keepsakeId = params.get('id')

  const [keepsake, setKeepsake]     = useState<Keepsake | null>(null)
  const [loadError, setLoadError]   = useState('')
  const [isLoading, setIsLoading]   = useState(true)

  const [proofType, setProofType]   = useState<ProofType>('ownership')
  const [cutoffDate, setCutoffDate] = useState('')
  const [isProving, setIsProving]   = useState(false)
  const [result, setResult]         = useState<ProofResult | null>(null)
  const [proofError, setProofError] = useState('')
  const [comingSoon, setComingSoon] = useState(false)
  const [copied, setCopied]         = useState(false)

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
    if (jobStatus.status === 'done' && jobStatus.result) {
      setResult(jobStatus.result as unknown as ProofResult)
      setIsProving(false)
      setJobId(null)
    } else if (jobStatus.status === 'failed') {
      setProofError(jobStatus.error || 'Proof generation failed.')
      setIsProving(false)
      setJobId(null)
    }
  }, [jobStatus])

  async function handleProve() {
    const token = sessionStorage.getItem('mmToken')
    if (!token || !keepsake) return

    setIsProving(true)
    setProofError('')
    setComingSoon(false)
    setResult(null)

    const body: Record<string, unknown> = { proof_type: proofType }
    if (proofType === 'created_before' && cutoffDate) {
      body.cutoff_timestamp = Math.floor(new Date(cutoffDate).getTime() / 1000)
    }

    try {
      const res  = await fetch(`${apiBase}/memorymint/v1/midnight/${keepsake.id}/prove`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()

      if (res.status === 404 || data.code === 'rest_no_route' || data.code === 'midnight_not_configured') {
        setComingSoon(true)
        setIsProving(false)
        return
      }

      // Async path — job queued, keep isProving=true and start polling
      if (res.status === 202 && data.queued) {
        setJobId(data.job_id)
        return
      }

      if (!data.success) {
        setProofError(data.error || 'Proof generation failed.')
        setIsProving(false)
        return
      }

      // Synchronous path (fallback if API ever returns 200 directly)
      setResult(data.proof)
      setIsProving(false)
    } catch {
      setProofError('Network error. Please try again.')
      setIsProving(false)
    }
  }

  function handleCopyLink() {
    if (!result) return
    navigator.clipboard?.writeText(`${window.location.origin}/share/proof?tx=${result.tx_id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/gallery" className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-600 transition-colors text-sm mb-8">
        ← Back to Gallery
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="text-4xl mb-3">🔐</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-schoolbell">Prove Your Memory</h1>
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
          <p className="font-semibold text-indigo-800 mb-1">Midnight proofs are coming soon</p>
          <p className="text-indigo-600 text-sm">The Midnight sidecar is not yet deployed. Check back once the sidecar is live.</p>
        </motion.div>
      )}

      {/* Polling progress banner */}
      {jobId && jobStatus.status && jobStatus.status !== 'done' && jobStatus.status !== 'failed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6 flex items-start gap-4"
        >
          <div className="text-2xl animate-spin mt-0.5">⚙️</div>
          <div>
            <p className="font-semibold text-purple-900">Generating your zero-knowledge proof…</p>
            <p className="text-purple-700 text-sm mt-1">
              This takes up to 15 minutes while the Midnight network processes your request.
              Keep this tab open — the result will appear automatically.
            </p>
          </div>
        </motion.div>
      )}

      {result ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <div className="text-5xl text-center mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-1 font-schoolbell">Proof Generated</h2>
          <p className="text-center text-gray-500 text-sm mb-6">
            {PROOF_OPTIONS.find(o => o.value === result.proof_type)?.label} verified on-chain
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Proof type</span>
              <span className="font-semibold text-gray-700">{PROOF_OPTIONS.find(o => o.value === result.proof_type)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Transaction ID</span>
              <code className="text-xs text-gray-600 truncate max-w-[180px]">{result.tx_id}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Proved at</span>
              <span className="text-gray-700">{new Date(result.proved_at).toLocaleString()}</span>
            </div>
          </div>

          <button type="button" onClick={handleCopyLink}
            className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold py-3 rounded-2xl transition-all mb-3"
          >
            {copied ? '✓ Link copied!' : '🔗 Copy shareable proof link'}
          </button>
          <button type="button" onClick={() => setResult(null)}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            Generate another proof
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Select proof type</h2>

          <div className="space-y-3 mb-6">
            {PROOF_OPTIONS.map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  proofType === opt.value ? 'border-amber-400 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input type="radio" name="proofType" value={opt.value}
                  checked={proofType === opt.value}
                  onChange={() => setProofType(opt.value)}
                  aria-label={opt.label}
                  className="mt-1 accent-[#ffbd59]"
                />
                <div>
                  <span className="text-xl mr-2">{opt.icon}</span>
                  <span className="font-semibold text-gray-800">{opt.label}</span>
                  <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {proofType === 'created_before' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cutoff date</label>
              <input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <p className="text-xs text-gray-400 mt-1">Proves this memory existed before this date.</p>
            </div>
          )}

          {proofError && <p className="text-red-500 text-sm mb-4">{proofError}</p>}

          <button type="button" onClick={handleProve}
            disabled={isProving || (proofType === 'created_before' && !cutoffDate) || keepsake?.midnight_status !== 'minted'}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all"
          >
            {isProving ? 'Generating proof…' : 'Generate Zero-Knowledge Proof'}
          </button>

          {keepsake?.midnight_status !== 'minted' && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Proofs are only available for keepsakes with Midnight status: minted.
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default function ProvePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <ProvePageInner />
    </Suspense>
  )
}
