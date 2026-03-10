'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { EXPLORER_BASE } from '@/lib/cardano'

interface SharedKeepsake {
  id: number
  title: string
  description: string
  file_type: string
  file_url: string
  privacy: string
  tx_hash: string | null
  creator_name: string
  created_at: string
}

export default function ShareContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [keepsake, setKeepsake] = useState<SharedKeepsake | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No share token provided.')
      setIsLoading(false)
      return
    }

    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

    fetch(`${apiBase}/memorymint/v1/gallery/shared/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.keepsake) {
          setKeepsake(data.keepsake)
        } else {
          setError(data.error || 'This memory could not be found.')
        }
      })
      .catch(() => setError('Could not reach the server. Please try again.'))
      .finally(() => setIsLoading(false))
  }, [token])

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin inline-block">⚙️</div>
          <p className="text-gray-500 text-lg">Loading memory…</p>
        </div>
      </div>
    )
  }

  if (error || !keepsake) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="text-6xl mb-6">🔒</div>
          <h1
            className="text-3xl font-bold mb-4 text-gray-800"
            style={{ fontFamily: "'Grape Nuts', cursive" }}
          >
            Memory Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            {error || 'This link may have expired or been revoked.'}
          </p>
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-xl transition-all"
            >
              Go to Memory Mint
            </motion.button>
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <p className="text-gray-500 text-sm mb-2">
          {keepsake.creator_name} shared a memory with you
        </p>
        <h1
          className="text-4xl font-bold text-gray-800"
          style={{ fontFamily: "'Grape Nuts', cursive" }}
        >
          {keepsake.title}
        </h1>
      </motion.div>

      {/* Polaroid-style card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white pt-4 px-4 pb-12 rounded-[2px] shadow-[0_8px_40px_rgb(0,0,0,0.15),0_2px_6px_rgb(0,0,0,0.1)] mx-auto max-w-2xl"
      >
        {keepsake.file_type === 'image' && keepsake.file_url ? (
          <div className="relative" style={{ aspectRatio: '4/3' }}>
            <Image
              src={keepsake.file_url}
              alt={keepsake.title}
              fill
              className="object-cover"
            />
          </div>
        ) : keepsake.file_type === 'video' && keepsake.file_url ? (
          <video
            src={keepsake.file_url}
            className="w-full"
            style={{ aspectRatio: '4/3', objectFit: 'cover' }}
            controls
            playsInline
          />
        ) : keepsake.file_type === 'audio' && keepsake.file_url ? (
          <div className="bg-gradient-to-br from-amber-50 to-mint-yellow flex flex-col items-center justify-center gap-4 py-12">
            <div className="text-6xl">🎵</div>
            <audio src={keepsake.file_url} controls className="w-full max-w-sm" />
          </div>
        ) : (
          <div className="bg-gradient-to-br from-amber-50 to-mint-yellow flex items-center justify-center py-16">
            <span className="text-6xl">📷</span>
          </div>
        )}

        <div className="text-center pt-6 pb-2 px-4">
          {keepsake.description && (
            <p className="text-gray-600 leading-relaxed mb-4">{keepsake.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <span>{keepsake.creator_name}</span>
            <span>·</span>
            <span>{new Date(keepsake.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyLink}
          className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-xl border-2 border-gray-200 transition-all"
        >
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </motion.button>

        {keepsake.tx_hash && (
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href={`${EXPLORER_BASE}/transaction/${keepsake.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-xl border-2 border-gray-200 transition-all text-center"
          >
            🔍 View Proof on Blockchain
          </motion.a>
        )}
      </motion.div>

      {keepsake.tx_hash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 text-center"
        >
          <p className="text-sm text-amber-800 font-medium mb-1">✅ Permanently preserved on the Cardano blockchain</p>
          <p className="text-xs text-amber-700 font-mono break-all">{keepsake.tx_hash}</p>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12 bg-mint-yellow rounded-2xl p-8 text-center"
      >
        <h2
          className="text-2xl font-semibold mb-3 text-gray-800"
          style={{ fontFamily: "'Grape Nuts', cursive" }}
        >
          Preserve your own memories
        </h2>
        <p className="text-gray-700 mb-6">
          Mint a moment. Keep it forever on the Cardano blockchain.
        </p>
        <Link href="/mint">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-xl shadow-lg transition-all"
          >
            Get Started Free
          </motion.button>
        </Link>
      </motion.div>
    </div>
  )
}
