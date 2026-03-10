'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import LoginModal from '@/components/LoginModal'
import SampleGallery from '@/components/SampleGallery'
import { useRouter } from 'next/navigation'
import { EXPLORER_BASE } from '@/lib/cardano'

interface PublicKeepsake {
  id: number
  title: string
  description: string
  file_type: string
  file_url: string
  tx_hash: string | null
  creator_name: string
  created_at: string
}

const PER_PAGE = 12

export default function MemoriesPage() {
  const [memories, setMemories] = useState<PublicKeepsake[]>([])
  const [isLoadingFeed, setIsLoadingFeed] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for existing login (either wallet or email)
    const savedEmail = sessionStorage.getItem('userEmail')
    const walletConnected = sessionStorage.getItem('walletConnected')
    if (savedEmail || walletConnected) {
      setIsLoggedIn(true)
    }
  }, [])

  const fetchMemories = async (pageNum: number) => {
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    try {
      const res = await fetch(`${apiBase}/memorymint/v1/gallery/public?per_page=${PER_PAGE}&page=${pageNum}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.keepsakes)) {
        setMemories(prev => pageNum === 1 ? data.keepsakes : [...prev, ...data.keepsakes])
        setHasMore(data.keepsakes.length >= PER_PAGE)
        setPage(pageNum)
      }
    } catch {
      /* silently ignore — show empty state */
    }
  }

  // Fetch public minted keepsakes
  useEffect(() => {
    fetchMemories(1).finally(() => setIsLoadingFeed(false))
  }, [])

  const loadMore = async () => {
    setIsLoadingMore(true)
    await fetchMemories(page + 1)
    setIsLoadingMore(false)
  }

  const handleLoginSuccess = (type: 'wallet' | 'email', data: any) => {
    if (type === 'email') {
      sessionStorage.setItem('userEmail', data.email)
      setIsLoggedIn(true)
      setShowLoginModal(false)
      router.push('/gallery')
    } else if (type === 'wallet') {
      // For wallet, we mark as connected but don't need to store all wallet data
      // The Header component will handle the full wallet state
      sessionStorage.setItem('walletConnected', 'true')
      setIsLoggedIn(true)
      setShowLoginModal(false)
      router.push('/gallery')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Page Intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Memories, all in one place
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
          A personal gallery of meaningful moments — available anytime, and shared only on your terms.
        </p>

        <Link href="/mint">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
          >
            Create a New Memory
          </motion.button>
        </Link>
      </motion.div>

      {/* Sharing Modes */}
      <div className="mb-16">
        <h2 className="text-3xl font-semibold text-center mb-10 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Choose how you share
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Public */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
          >
            <div className="text-5xl mb-4">🌍</div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Public</h3>
            <p className="text-gray-700 leading-relaxed">
              Anyone with the link can view this memory.
            </p>
          </motion.div>

          {/* Shared */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
          >
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Shared</h3>
            <p className="text-gray-700 leading-relaxed">
              Only people you invite can access it.
            </p>
          </motion.div>

          {/* Private (Midnight) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
          >
            <div className="text-5xl mb-4">🔐</div>
            <h3 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Private (Midnight)</h3>
            <p className="text-gray-700 leading-relaxed">
              Sensitive details remain private while proof is preserved securely.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Sample Memory Gallery */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-16"
      >
        <h2 className="text-3xl font-semibold text-center mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Sample Memory Gallery
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Here's what your preserved memories might look like. Click on any keepsake to see details!
        </p>

        <SampleGallery />
      </motion.div>

      {/* Live Public Memory Feed */}
      {isLoadingFeed ? (
        <div className="text-center py-8 text-gray-400">Loading recent memories…</div>
      ) : memories.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-semibold text-center mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Recently Minted
          </h2>
          <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
            Real memories preserved forever on the Cardano blockchain.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {memories.map((memory) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all"
              >
                {memory.file_type === 'image' && memory.file_url ? (
                  <div className="relative h-48 bg-gray-100">
                    <Image
                      src={memory.file_url}
                      alt={memory.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : memory.file_type === 'video' && memory.file_url ? (
                  <video
                    src={memory.file_url}
                    className="w-full h-48 object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="h-48 bg-gradient-to-br from-amber-50 to-mint-yellow flex items-center justify-center text-5xl">
                    {memory.file_type === 'audio' ? '🎵' : '📷'}
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-lg font-semibold mb-1 text-gray-800 truncate" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                    {memory.title}
                  </h3>
                  {memory.description && (
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">{memory.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{memory.creator_name}</span>
                    <span>{new Date(memory.created_at).toLocaleDateString()}</span>
                  </div>
                  {memory.tx_hash && (
                    <a
                      href={`${EXPLORER_BASE}/transaction/${memory.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-xs text-amber-600 hover:underline truncate"
                    >
                      View on blockchain →
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-10">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={loadMore}
                disabled={isLoadingMore}
                className="bg-white hover:bg-gray-50 text-gray-700 font-semibold px-10 py-4 rounded-2xl shadow-md border-2 border-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? 'Loading…' : 'Load More'}
              </motion.button>
            </div>
          )}
        </motion.div>
      ) : null}

      {/* Learn More Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-16 bg-mint-yellow rounded-2xl p-8 text-center"
      >
        <h2 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Want to learn more?
        </h2>
        <p className="text-gray-700 mb-6">
          Discover how Memory Mint preserves your moments forever.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/guide">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Read the Guide
            </motion.button>
          </Link>
          <Link href="/midnight">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-xl border-2 border-gray-200 transition-all"
            >
              Learn about Privacy
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(type, data) => handleLoginSuccess(type, data)}
      />
    </div>
  )
}
