'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import Link from 'next/link'
import SeedPhraseModal from '@/components/SeedPhraseModal'
import { connectWallet, EXPLORER_BASE } from '@/lib/cardano'

interface Memory {
  id: string
  title: string
  description: string
  image: string
  mediaType?: 'image' | 'video'
  timestamp: number
  privacy: 'public' | 'shared' | 'private'
  txHash?: string
  mintStatus?: string
}

interface Album {
  id: number
  name: string
  keepsakeIds: number[]
  keepsakeCount: number
  createdAt: string
}

// Sample memories for demo - using static timestamps to avoid hydration errors
const sampleMemories: Memory[] = [
  {
    id: '1',
    title: 'Summer Vacation 2025',
    description: 'Our family trip to the mountains. Such beautiful memories!',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500',
    timestamp: 1736208000000, // January 7, 2025
    privacy: 'shared',
    txHash: 'abc123def456',
  },
  {
    id: '2',
    title: 'Wedding Anniversary',
    description: '25 years together. Forever grateful for this journey.',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=500',
    timestamp: 1733529600000, // December 7, 2024
    privacy: 'private',
    txHash: 'xyz789ghi012',
  },
  {
    id: '3',
    title: 'Graduation Day',
    description: 'So proud of this achievement. The beginning of a new chapter!',
    image: 'https://images.unsplash.com/photo-1627556704302-624286467c65?w=500',
    timestamp: 1730332800000, // October 31, 2024
    privacy: 'public',
    txHash: 'mno345pqr678',
  },
  {
    id: '4',
    title: 'Beach Sunset',
    description: 'Peaceful evening by the ocean. The perfect end to a perfect day.',
    image: 'https://videos.pexels.com/video-files/1093662/1093662-hd_1280_720_25fps.mp4',
    mediaType: 'video',
    timestamp: 1727740800000, // October 1, 2024
    privacy: 'public',
    txHash: 'def456ghi789',
  },
  {
    id: '5',
    title: 'Birthday Celebration',
    description: 'Surrounded by loved ones. Best birthday ever!',
    image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500',
    timestamp: 1725148800000, // September 1, 2024
    privacy: 'shared',
    txHash: 'jkl012mno345',
  },
  {
    id: '6',
    title: 'Family Recipe Book',
    description: 'Grandma\'s secret recipes preserved forever. A treasure passed down.',
    image: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500',
    timestamp: 1722470400000, // August 1, 2024
    privacy: 'private',
    txHash: 'pqr678stu901',
  },
  {
    id: '7',
    title: 'New Home Keys',
    description: 'Our first home together. Dreams really do come true!',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500',
    timestamp: 1719792000000, // July 1, 2024
    privacy: 'public',
    txHash: 'vwx234yz567',
  },
  {
    id: '8',
    title: 'Concert Night',
    description: 'Saw my favorite band live. Unforgettable experience!',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500',
    timestamp: 1717200000000, // June 1, 2024
    privacy: 'shared',
    txHash: 'abc890def123',
  },
  {
    id: '9',
    title: 'Childhood Memories',
    description: 'Old photos from my childhood. These moments shaped who I am.',
    image: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=500',
    timestamp: 1714521600000, // May 1, 2024
    privacy: 'private',
    txHash: 'ghi456jkl789',
  },
]

export default function GalleryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [detailMemory, setDetailMemory] = useState<Memory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPrivacy, setFilterPrivacy] = useState<'all' | 'public' | 'shared' | 'private'>('all')
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [showInfo, setShowInfo] = useState(true)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)

  // Album state
  const [albums, setAlbums] = useState<Album[]>([])
  const [newAlbumName, setNewAlbumName] = useState('')
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false)
  const [albumSuccess, setAlbumSuccess] = useState('')

  const albumApiBase = () =>
    (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  const loadAlbums = async (token: string) => {
    try {
      const res = await fetch(`${albumApiBase()}/memorymint/v1/albums`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setAlbums(data.albums)
    } catch {}
  }

  const addToAlbum = async (albumId: number, memoryId: string) => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    try {
      await fetch(`${albumApiBase()}/memorymint/v1/albums/${albumId}/keepsakes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepsake_ids: [parseInt(memoryId)] }),
      })
      setAlbums((prev) => prev.map((a) =>
        a.id === albumId
          ? { ...a, keepsakeIds: [...new Set([...a.keepsakeIds, parseInt(memoryId)])], keepsakeCount: a.keepsakeCount + 1 }
          : a
      ))
      setAlbumSuccess('Added to album!')
      setTimeout(() => setAlbumSuccess(''), 2000)
    } catch {}
  }

  const createAlbumWithMemory = async (memoryId: string) => {
    if (!newAlbumName.trim()) return
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    try {
      const res = await fetch(`${albumApiBase()}/memorymint/v1/albums`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAlbumName.trim() }),
      })
      const data = await res.json()
      if (!data.success) return
      const newAlbum: Album = data.album
      // Add the keepsake to the newly created album
      await fetch(`${albumApiBase()}/memorymint/v1/albums/${newAlbum.id}/keepsakes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepsake_ids: [parseInt(memoryId)] }),
      })
      newAlbum.keepsakeIds = [parseInt(memoryId)]
      newAlbum.keepsakeCount = 1
      setAlbums((prev) => [...prev, newAlbum])
      setNewAlbumName('')
      setShowNewAlbumInput(false)
      setAlbumSuccess(`Album "${newAlbum.name}" created!`)
      setTimeout(() => setAlbumSuccess(''), 2500)
    } catch {}
  }

  const isInAlbum = (albumId: number, memoryId: string) =>
    albums.find((a) => a.id === albumId)?.keepsakeIds.includes(parseInt(memoryId)) ?? false

  const removeFromAlbum = async (albumId: number, memoryId: string) => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    try {
      await fetch(`${albumApiBase()}/memorymint/v1/albums/${albumId}/keepsakes/${memoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setAlbums((prev) => prev.map((a) =>
        a.id === albumId
          ? { ...a, keepsakeIds: a.keepsakeIds.filter((id) => id !== parseInt(memoryId)), keepsakeCount: a.keepsakeCount - 1 }
          : a
      ))
      setAlbumSuccess('Removed from album!')
      setTimeout(() => setAlbumSuccess(''), 2000)
    } catch {}
  }

  const [activeAlbumId, setActiveAlbumId] = useState<number | null>(null)

  // Email user / API state
  const [isEmailUser, setIsEmailUser] = useState(false)
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [needsBackup, setNeedsBackup] = useState(false)
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [isCustodial, setIsCustodial] = useState(false)
  const [custodialWalletAddress, setCustodialWalletAddress] = useState('')
  const [addressCopied, setAddressCopied] = useState(false)

  // Keepsake retry state
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<{ id: string; message: string } | null>(null)

  // Share link state
  const [copyingShareId, setCopyingShareId] = useState<string | null>(null)
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)

  // Load real keepsakes for email (mmToken) users
  useEffect(() => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return

    setIsEmailUser(true)
    setIsLoadingGallery(true)
    setGalleryError('')

    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

    // Verify token is still valid before fetching keepsakes
    fetch(`${apiBase}/memorymint/v1/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('session_expired')
        return r.json()
      })
      .then((verifyData) => {
        if (verifyData?.user?.needs_seed_backup) setNeedsBackup(true)
        if (verifyData?.user?.is_custodial) {
          setIsCustodial(true)
          setCustodialWalletAddress(verifyData.user.wallet_address || '')
        }
        return fetch(`${apiBase}/memorymint/v1/keepsakes`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.keepsakes)) {
          const realMemories: Memory[] = data.keepsakes.map((k: any) => ({
            id: k.id.toString(),
            title: k.title,
            description: k.description || '',
            image: k.file_url || '',
            mediaType: k.file_type === 'video' ? ('video' as const) : undefined,
            timestamp: new Date(k.created_at).getTime(),
            privacy: k.privacy as 'public' | 'shared' | 'private',
            txHash: k.tx_hash || undefined,
            mintStatus: k.mint_status,
          }))
          setMemories(realMemories)
        } else {
          setGalleryError(data.error || 'Could not load your keepsakes.')
        }
      })
      .then(() => loadAlbums(token))
      .catch((err) => {
        if (err.message === 'session_expired') {
          sessionStorage.removeItem('mmToken')
          sessionStorage.removeItem('mmTokenExpiry')
          sessionStorage.removeItem('userEmail')
          setGalleryError('Your session has expired. Please log in again.')
        } else {
          setGalleryError('Could not reach the server. Please try again.')
        }
      })
      .finally(() => setIsLoadingGallery(false))
  }, [])

  const createShareLink = async (memory: Memory) => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    setCopyingShareId(memory.id)
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    try {
      const res = await fetch(`${apiBase}/memorymint/v1/share/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepsake_id: parseInt(memory.id) }),
      })
      const data = await res.json()
      if (data.success && data.share_url) {
        await navigator.clipboard.writeText(data.share_url)
        setCopiedShareId(memory.id)
        setTimeout(() => setCopiedShareId(null), 3000)
      }
    } catch {
      // silently fail
    } finally {
      setCopyingShareId(null)
    }
  }

  const handleRetryKeepsake = async (memory: Memory) => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    setRetryingId(memory.id)
    setRetryError(null)

    try {
      // 1. Reset keepsake (works on both 'minting' and 'failed')
      const resetRes = await fetch(`${apiBase}/memorymint/v1/mint/retry/${memory.id}`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!resetRes.ok) throw new Error('Could not reset keepsake.')

      // 2. Rebuild transaction
      const buildRes = await fetch(`${apiBase}/memorymint/v1/mint/build`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ keepsake_id: parseInt(memory.id) }),
      })
      const buildData = await buildRes.json()
      if (!buildData.success) throw new Error(buildData.error || 'Failed to build transaction.')
      const unsignedTx: string = buildData.unsigned_tx

      // 3. Sign & submit
      const mmWalletKey = sessionStorage.getItem('mmWalletKey')
      let txHash = ''

      if (mmWalletKey) {
        // Browser wallet user
        const walletApi = await connectWallet(mmWalletKey)
        const witnessHex: string = await walletApi.signTx(unsignedTx, true)
        const signRes = await fetch(`${apiBase}/memorymint/v1/mint/sign`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ keepsake_id: parseInt(memory.id), witness: witnessHex, unsigned_tx: unsignedTx }),
        })
        const signData = await signRes.json()
        if (!signData.success) throw new Error(signData.error || 'Signing failed.')
        txHash = signData.tx_hash || ''
      } else {
        // Email (custodial) user
        const signRes = await fetch(`${apiBase}/memorymint/v1/mint/custodial-sign`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ keepsake_id: parseInt(memory.id), unsigned_tx: unsignedTx }),
        })
        const signData = await signRes.json()
        if (!signData.success) throw new Error(signData.error || 'Signing failed.')
        txHash = signData.tx_hash || ''
      }

      // 4. Update local state — card flips to minted
      setMemories((prev) =>
        prev.map((m) => (m.id === memory.id ? { ...m, mintStatus: 'minted', txHash } : m))
      )
    } catch (err: any) {
      setRetryError({ id: memory.id, message: err.message || 'Retry failed.' })
    } finally {
      setRetryingId(null)
    }
  }

  const deleteAlbum = async (albumId: number) => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    try {
      await fetch(`${albumApiBase()}/memorymint/v1/albums/${albumId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setAlbums((prev) => prev.filter((a) => a.id !== albumId))
      if (activeAlbumId === albumId) setActiveAlbumId(null)
    } catch {}
  }

  // Filter and search memories
  const filteredMemories = memories.filter((memory) => {
    const matchesSearch =
      memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = filterPrivacy === 'all' || memory.privacy === filterPrivacy

    const matchesAlbum =
      activeAlbumId === null ||
      (albums.find((a) => a.id === activeAlbumId)?.keepsakeIds.includes(parseInt(memory.id)) ?? false)

    return matchesSearch && matchesFilter && matchesAlbum
  })

  const selectedMemory = selectedIndex !== null ? filteredMemories[selectedIndex] : null

  // Navigation helpers
  const goNext = useCallback(() => {
    if (selectedIndex === null) return
    if (selectedIndex < filteredMemories.length - 1) {
      setSlideDirection(1)
      setSelectedIndex(selectedIndex + 1)
    } else {
      // Stop auto-play at the end
      setIsAutoPlaying(false)
    }
  }, [selectedIndex, filteredMemories.length])

  const goPrev = useCallback(() => {
    if (selectedIndex === null) return
    if (selectedIndex > 0) {
      setSlideDirection(-1)
      setSelectedIndex(selectedIndex - 1)
    }
  }, [selectedIndex])

  const closeSlideshow = useCallback(() => {
    setSelectedIndex(null)
    setIsAutoPlaying(false)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          goNext()
          setIsAutoPlaying(false)
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          setIsAutoPlaying(false)
          break
        case 'Escape':
          e.preventDefault()
          closeSlideshow()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, goNext, goPrev, closeSlideshow])

  // Auto-play timer
  useEffect(() => {
    if (isAutoPlaying && selectedIndex !== null) {
      autoPlayRef.current = setInterval(() => {
        goNext()
      }, 5000)
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    }
  }, [isAutoPlaying, goNext, selectedIndex])

  // Swipe handler
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x < -threshold) {
      goNext()
      setIsAutoPlaying(false)
    } else if (info.offset.x > threshold) {
      goPrev()
      setIsAutoPlaying(false)
    }
  }

  // Get full resolution URL for slideshow (strip size constraints)
  const getFullResUrl = (url: string) => {
    try {
      const parsed = new URL(url)
      parsed.searchParams.delete('w')
      parsed.searchParams.delete('h')
      parsed.searchParams.delete('q')
      return parsed.toString()
    } catch {
      return url
    }
  }

  // Slide animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  }

  const privacyColors = {
    public: 'bg-green-100 text-green-700',
    shared: 'bg-blue-100 text-blue-700',
    private: 'bg-purple-100 text-purple-700',
  }

  const privacyIcons = {
    public: '🌍',
    shared: '👥',
    private: '🔐',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Your Memory Gallery</h1>
          <p className="text-xl text-gray-600">
            A private space where all your preserved moments live.
          </p>
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
          {filteredMemories.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSlideDirection(1); setSelectedIndex(0) }}
              className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Slideshow
            </motion.button>
          )}
          <Link href="/mint">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl shadow-lg transition-all"
            >
              ✨ New Memory
            </motion.button>
          </Link>
          <Link href="/midnight">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <img src="/midnight-logo.png" alt="Midnight" className="w-5 h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              Midnight
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Login / demo banner */}
      {!isEmailUser && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👋</span>
            <div>
              <p className="font-semibold text-amber-900">Viewing sample memories</p>
              <p className="text-sm text-amber-700">Log in with your wallet or email to see your real keepsakes here.</p>
            </div>
          </div>
          <Link href="/mint">
            <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-5 py-2 rounded-xl text-sm transition-all">
              Get Started
            </button>
          </Link>
        </div>
      )}

      {/* Loading gallery */}
      {isLoadingGallery && (
        <div className="mb-6 text-center py-10">
          <div className="text-4xl mb-3 animate-spin inline-block">⚙️</div>
          <p className="text-gray-500 font-medium">Loading your keepsakes...</p>
        </div>
      )}

      {/* Gallery fetch error */}
      {galleryError && !isLoadingGallery && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl px-6 py-4">
          <p className="text-red-700 font-semibold">Could not load gallery</p>
          <p className="text-red-600 text-sm mt-1">{galleryError}</p>
        </div>
      )}

      {/* Wallet backup banner — email (custodial) users only, disappears after backup */}
      {needsBackup && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-6 flex items-center justify-between gap-4 bg-mint-yellow border-2 border-mint-gold rounded-2xl px-5 py-4"
        >
          <div>
            <p className="font-semibold text-gray-800">⚠️ Back up your wallet seed phrase</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Your seed phrase is stored on our servers. Back it up and we&apos;ll delete it permanently.
            </p>
          </div>
          <button
            onClick={() => setShowSeedModal(true)}
            className="shrink-0 bg-mint-gold hover:opacity-90 text-white font-semibold px-4 py-2 rounded-xl transition-all text-sm"
          >
            Back Up Now
          </button>
        </motion.div>
      )}

      {/* Fund wallet banner — custodial users who have completed seed backup */}
      {isCustodial && !needsBackup && custodialWalletAddress && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-2xl px-5 py-4"
        >
          <p className="font-semibold text-blue-800 mb-1">💳 Fund your wallet to mint</p>
          <p className="text-sm text-blue-700 mb-3">
            Each mint requires at least <strong>2.5 ADA</strong> in your wallet to cover the Cardano network fee.
            Send ADA from an exchange or another wallet to your address below.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 break-all flex-1 min-w-0">
              {custodialWalletAddress}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(custodialWalletAddress)
                setAddressCopied(true)
                setTimeout(() => setAddressCopied(false), 2000)
              }}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg transition-all text-sm"
            >
              {addressCopied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Search and Filter */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search memories by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-gray-200 focus:border-mint-gold focus:outline-none transition-colors"
              />
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Privacy Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterPrivacy('all')}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                filterPrivacy === 'all'
                  ? 'bg-mint-gold text-gray-800'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterPrivacy('public')}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                filterPrivacy === 'public'
                  ? 'bg-green-100 text-green-700 border-2 border-green-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
              }`}
            >
              🌍 Public
            </button>
            <button
              onClick={() => setFilterPrivacy('shared')}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                filterPrivacy === 'shared'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
              }`}
            >
              👥 Shared
            </button>
            <button
              onClick={() => setFilterPrivacy('private')}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                filterPrivacy === 'private'
                  ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
              }`}
            >
              🔐 Private
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredMemories.length} of {memories.length} memories
          {searchQuery && ` for "${searchQuery}"`}
          {filterPrivacy !== 'all' && ` · Filtered by ${filterPrivacy}`}
          {activeAlbumId !== null && ` · Album: ${albums.find(a => a.id === activeAlbumId)?.name}`}
        </div>
      </div>

      {/* Albums Library Section */}
      {albums.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
              📁 Albums
            </h2>
            <span className="text-sm text-gray-400">{albums.length} album{albums.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2">
            {/* All Keepsakes tile */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveAlbumId(null)}
              className={`shrink-0 w-44 rounded-2xl overflow-hidden border-2 transition-all text-left ${
                activeAlbumId === null
                  ? 'border-mint-gold shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="h-28 bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                <span className="text-5xl">🖼️</span>
              </div>
              <div className="p-3 bg-white">
                <p className="font-semibold text-gray-800 text-sm truncate" style={{ fontFamily: "'Grape Nuts', cursive" }}>All Keepsakes</p>
                <p className="text-xs text-gray-400">{memories.length} keepsakes</p>
              </div>
            </motion.button>

            {/* Album tiles */}
            {albums.map((album) => {
              const coverMemory = memories.find((m) => album.keepsakeIds.includes(parseInt(m.id)))
              const isActive = activeAlbumId === album.id
              return (
                <div key={album.id} className="shrink-0 w-44 relative group">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveAlbumId(isActive ? null : album.id)}
                    className={`w-full rounded-2xl overflow-hidden border-2 transition-all text-left ${
                      isActive
                        ? 'border-mint-gold shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="h-28 bg-gray-100 overflow-hidden relative">
                      {coverMemory ? (
                        coverMemory.mediaType === 'video' ? (
                          <video
                            src={coverMemory.image}
                            className={`w-full h-full object-cover ${coverMemory.privacy === 'private' ? 'blur-sm' : ''}`}
                            muted
                          />
                        ) : (
                          <img
                            src={coverMemory.image}
                            alt={album.name}
                            className={`w-full h-full object-cover ${coverMemory.privacy === 'private' ? 'blur-sm' : ''}`}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
                          <span className="text-5xl">📁</span>
                        </div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 bg-mint-gold/20 flex items-center justify-center">
                          <div className="bg-mint-gold rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-lg">✓</div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white">
                      <p className="font-semibold text-gray-800 text-sm truncate" style={{ fontFamily: "'Grape Nuts', cursive" }}>{album.name}</p>
                      <p className="text-xs text-gray-400">{album.keepsakeCount} keepsake{album.keepsakeCount !== 1 ? 's' : ''}</p>
                    </div>
                  </motion.button>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteAlbum(album.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex shadow transition-all"
                    title="Delete album"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Memory Grid */}
      {filteredMemories.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-12">
          {filteredMemories.map((memory, index) => {
            const tapeAngles = [-8, 3, 12, -5, 6, -10, 8, -3, 5]
            const tapePositions = ['right-6', 'left-1/2 -translate-x-1/2', 'left-8', 'right-10', 'left-6', 'right-8', 'left-10', 'right-4', 'left-1/2 -translate-x-1/2']
            const cardRotations = [1.5, -1.2, 2, -0.8, 1.8, -1.5, 1, -2, 0.5]

            return (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 20, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: cardRotations[index % 9] || 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ rotate: 0, y: -8, scale: 1.02 }}
                onClick={() => { setDetailMemory(memory); setAlbumSuccess(''); setShowNewAlbumInput(false); setNewAlbumName('') }}
                className="cursor-pointer mx-auto w-full max-w-sm"
              >
                <div className="relative">
                  {/* Tape piece */}
                  <div
                    className={`absolute -top-2 ${tapePositions[index % 9]} w-12 h-5 z-10 rounded-sm shadow-sm`}
                    style={{
                      transform: `rotate(${tapeAngles[index % 9]}deg)`,
                      background: 'linear-gradient(135deg, rgba(245,222,179,0.75) 0%, rgba(222,198,156,0.5) 100%)',
                    }}
                  />
                  <div className="bg-white pt-3 px-3 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
                    {/* Photo Area */}
                    <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '16/10' }}>
                      {memory.mediaType === 'video' ? (
                        <video
                          src={memory.image}
                          className={`w-full h-full object-cover ${memory.privacy === 'private' ? 'blur-lg' : ''}`}
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={memory.image}
                          alt={memory.title}
                          className={`w-full h-full object-cover ${memory.privacy === 'private' ? 'blur-lg' : ''}`}
                        />
                      )}
                      {memory.privacy === 'private' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="bg-white/90 px-4 py-2 rounded-xl">
                            <p className="text-sm font-medium text-gray-800">🔐 Private - Blurred</p>
                          </div>
                        </div>
                      )}
                      {memory.mediaType === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/60 rounded-full p-3">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${privacyColors[memory.privacy]}`}>
                        {privacyIcons[memory.privacy]} {memory.privacy.charAt(0).toUpperCase() + memory.privacy.slice(1)}
                      </div>
                    </div>
                    {/* Polaroid Caption */}
                    <div className="text-center pt-4 pb-1">
                      <h3 className="text-lg font-bold mb-1 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>{memory.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2">{memory.description}</p>
                      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{new Date(memory.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
                        {memory.mintStatus && memory.mintStatus !== 'minted' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-medium text-xs ${
                              memory.mintStatus === 'pending' ? 'text-gray-400' :
                              memory.mintStatus === 'minting' ? 'text-blue-500' :
                              'text-red-500'
                            }`}>
                              {memory.mintStatus === 'pending' ? '⏳ Pending' :
                               memory.mintStatus === 'minting' ? '⚙️ Minting...' :
                               '✗ Failed'}
                            </span>
                            {(memory.mintStatus === 'minting' || memory.mintStatus === 'failed') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRetryKeepsake(memory) }}
                                disabled={retryingId === memory.id}
                                className="text-xs font-semibold text-mint-gold hover:underline disabled:opacity-50"
                              >
                                {retryingId === memory.id ? 'Retrying…' : 'Retry →'}
                              </button>
                            )}
                            {retryError?.id === memory.id && (
                              <span className="text-xs text-red-500 max-w-[120px] text-center leading-tight">{retryError.message}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-500 font-medium">View Details →</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : !isLoadingGallery && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-16 text-center shadow-lg mb-12"
        >
          {!isEmailUser ? (
            <>
              <div className="text-6xl mb-6">🔐</div>
              <h2 className="text-3xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                Your gallery is private
              </h2>
              <p className="text-gray-600 mb-6 text-lg">Log in to view your minted memories.</p>
            </>
          ) : !searchQuery && filterPrivacy === 'all' && activeAlbumId === null ? (
            <>
              <div className="text-6xl mb-6">✨</div>
              <h2 className="text-3xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                No keepsakes yet
              </h2>
              <p className="text-gray-600 mb-6 text-lg">
                Mint your first memory and it will appear here permanently on the blockchain.
              </p>
              <Link href="/mint">
                <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all">
                  ✨ Mint Your First Memory
                </button>
              </Link>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">🔍</div>
              <h2 className="text-3xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                No memories found
              </h2>
              <p className="text-gray-600 mb-6 text-lg">
                {searchQuery
                  ? `No results for "${searchQuery}". Try a different search term.`
                  : `No ${filterPrivacy} memories yet.`}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterPrivacy('all')
                }}
                className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Clear Filters
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* Keepsake Detail Modal */}
      <AnimatePresence>
        {detailMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailMemory(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Photo / Video */}
              <div className="relative pt-4 px-4">
                <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                  {detailMemory.mediaType === 'video' ? (
                    <video
                      src={detailMemory.image}
                      className={`w-full h-full object-cover ${detailMemory.privacy === 'private' ? 'blur-lg' : ''}`}
                      autoPlay loop muted playsInline controls
                    />
                  ) : (
                    <img
                      src={detailMemory.image}
                      alt={detailMemory.title}
                      className={`w-full h-full object-cover ${detailMemory.privacy === 'private' ? 'blur-lg' : ''}`}
                    />
                  )}
                  {detailMemory.privacy === 'private' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-white/95 px-6 py-4 rounded-2xl text-center">
                        <p className="text-lg font-bold text-gray-800 mb-1">🔐 Private Memory</p>
                        <p className="text-sm text-gray-600">This content is blurred for privacy</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDetailMemory(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-lg text-xl"
                >
                  ×
                </button>
              </div>

              <div className="p-8">
                {/* Title + Privacy */}
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-3xl font-bold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>{detailMemory.title}</h2>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium shrink-0 ml-4 ${privacyColors[detailMemory.privacy]}`}>
                    {privacyIcons[detailMemory.privacy]} {detailMemory.privacy.charAt(0).toUpperCase() + detailMemory.privacy.slice(1)}
                  </div>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">{detailMemory.description}</p>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="font-medium text-gray-800">{new Date(detailMemory.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Privacy:</span>
                      <p className="font-medium text-gray-800 capitalize">{detailMemory.privacy}</p>
                    </div>
                  </div>
                </div>

                {/* Album Section */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3" style={{ fontFamily: "'Grape Nuts', cursive" }}>📁 Albums</h3>

                  {albumSuccess && (
                    <div className={`mb-3 border px-4 py-2 rounded-xl text-sm font-medium ${albumSuccess.startsWith('Removed') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                      {albumSuccess.startsWith('Removed') ? '✕' : '✓'} {albumSuccess}
                    </div>
                  )}

                  {albums.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {albums.map((album) => {
                        const already = isInAlbum(album.id, detailMemory.id)

                        return (
                          <div
                            key={album.id}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm ${
                              already
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>📁</span>
                              <span className={`font-medium ${already ? 'text-green-800' : 'text-gray-700'}`}>{album.name}</span>
                              <span className="text-gray-400">({album.keepsakeCount})</span>
                            </span>
                            {already ? (
                              <button
                                onClick={() => removeFromAlbum(album.id, detailMemory.id)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
                              >
                                × Remove
                              </button>
                            ) : (
                              <button
                                onClick={() => addToAlbum(album.id, detailMemory.id)}
                                className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {showNewAlbumInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createAlbumWithMemory(detailMemory.id)}
                        placeholder="Album name..."
                        autoFocus
                        className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-mint-gold focus:outline-none text-sm"
                      />
                      <button
                        onClick={() => createAlbumWithMemory(detailMemory.id)}
                        className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-4 py-2 rounded-xl text-sm transition-all"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setShowNewAlbumInput(false); setNewAlbumName('') }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewAlbumInput(true)}
                      className="w-full border-2 border-dashed border-gray-300 hover:border-mint-gold hover:bg-amber-50 text-gray-500 hover:text-amber-700 font-medium px-4 py-3 rounded-xl text-sm transition-all"
                    >
                      + Create New Album
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isEmailUser && detailMemory.privacy !== 'private' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => createShareLink(detailMemory)}
                      disabled={copyingShareId === detailMemory.id}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-60"
                    >
                      {copiedShareId === detailMemory.id
                        ? '✓ Copied!'
                        : copyingShareId === detailMemory.id
                        ? '⏳ Generating...'
                        : '🔗 Copy Link'}
                    </motion.button>
                  )}
                  {detailMemory.txHash ? (
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={`${EXPLORER_BASE}/transaction/${detailMemory.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all text-center"
                    >
                      🔍 View Proof
                    </motion.a>
                  ) : null}
                </div>

                {/* Midnight section for private */}
                {detailMemory.privacy === 'private' && (
                  <div className="mt-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">🌙 Midnight Privacy Active</p>
                        <p className="text-sm text-gray-600">Sensitive details are protected</p>
                      </div>
                      <button className="text-xs text-purple-600 font-medium hover:underline">Manage</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Slideshow */}
      <AnimatePresence>
        {selectedMemory && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
              <div className="flex items-center gap-4">
                <span className="text-white/70 text-sm font-medium">
                  {selectedIndex + 1} / {filteredMemories.length}
                </span>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${privacyColors[selectedMemory.privacy]}`}>
                  {privacyIcons[selectedMemory.privacy]} {selectedMemory.privacy.charAt(0).toUpperCase() + selectedMemory.privacy.slice(1)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Auto-play toggle */}
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title={isAutoPlaying ? 'Pause slideshow' : 'Auto-play slideshow'}
                >
                  {isAutoPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                {/* Toggle info */}
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title={showInfo ? 'Hide details' : 'Show details'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {/* Close button */}
                <button
                  onClick={closeSlideshow}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
                  title="Close (Esc)"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Main Content Area with swipe */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              {/* Left Arrow */}
              {selectedIndex > 0 && (
                <button
                  onClick={() => { goPrev(); setIsAutoPlaying(false) }}
                  className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                  title="Previous (←)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Right Arrow */}
              {selectedIndex < filteredMemories.length - 1 && (
                <button
                  onClick={() => { goNext(); setIsAutoPlaying(false) }}
                  className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                  title="Next (→)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Slide Content */}
              <AnimatePresence mode="wait" custom={slideDirection}>
                <motion.div
                  key={selectedIndex}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  className="w-full h-full flex items-center justify-center px-16 md:px-24 cursor-grab active:cursor-grabbing"
                >
                  <div className="relative w-full h-full flex items-center justify-center">
                    {selectedMemory.mediaType === 'video' ? (
                      <video
                        src={getFullResUrl(selectedMemory.image)}
                        className="max-w-[92vw] max-h-[88vh] rounded-lg object-contain"
                        autoPlay
                        loop
                        playsInline
                        controls
                      />
                    ) : (
                      <img
                        src={getFullResUrl(selectedMemory.image)}
                        alt={selectedMemory.title}
                        className="max-w-[92vw] max-h-[88vh] rounded-lg object-contain"
                        draggable={false}
                      />
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Info Bar */}
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gradient-to-t from-black/90 to-transparent px-6 py-6 absolute bottom-0 left-0 right-0"
                >
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>{selectedMemory.title}</h2>
                    <p className="text-white/70 text-sm mb-4 leading-relaxed">{selectedMemory.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-white/50">
                        {new Date(selectedMemory.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex gap-2">
                        {isEmailUser && selectedMemory.privacy !== 'private' && (
                          <button
                            onClick={() => createShareLink(selectedMemory)}
                            disabled={copyingShareId === selectedMemory.id}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
                          >
                            {copiedShareId === selectedMemory.id
                              ? '✓ Copied!'
                              : copyingShareId === selectedMemory.id
                              ? '⏳...'
                              : '🔗 Copy Link'}
                          </button>
                        )}
                        {selectedMemory.txHash && (
                          <a
                            href={`${EXPLORER_BASE}/transaction/${selectedMemory.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            🔍 View Proof
                          </a>
                        )}
                      </div>
                    </div>
                    {selectedMemory.privacy === 'private' && (
                      <div className="mt-3 flex items-center gap-2 text-purple-300 text-sm">
                        <span>🌙 Midnight Privacy Active</span>
                        <span className="text-white/30">·</span>
                        <button className="hover:text-purple-200 underline">Manage</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress dots */}
            {filteredMemories.length <= 20 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
                {filteredMemories.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSlideDirection(i > selectedIndex ? 1 : -1)
                      setSelectedIndex(i)
                      setIsAutoPlaying(false)
                    }}
                    className={`rounded-full transition-all ${
                      i === selectedIndex
                        ? 'w-6 h-2 bg-mint-gold'
                        : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Auto-play progress bar */}
            {isAutoPlaying && (
              <motion.div
                key={`progress-${selectedIndex}`}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 5, ease: 'linear' }}
                className="absolute top-0 left-0 h-0.5 bg-mint-gold z-20"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-mint-yellow rounded-2xl p-8 text-center"
      >
        <h2 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Your memories are secure
        </h2>
        <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
          Every memory is permanently stored on the Cardano blockchain, ensuring they're preserved exactly as you created them.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/guide">
            <button className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-xl border-2 border-gray-200 transition-all">
              Learn More
            </button>
          </Link>
          <Link href="/faq">
            <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all">
              Have Questions?
            </button>
          </Link>
        </div>
      </motion.div>

      <SeedPhraseModal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        onComplete={() => {
          setNeedsBackup(false)
          setShowSeedModal(false)
        }}
      />
    </div>
  )
}
