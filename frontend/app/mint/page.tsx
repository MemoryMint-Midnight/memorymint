'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import LoginModal from '@/components/LoginModal'
import { connectWallet, getWalletBalance, signDataForKey } from '@/lib/cardano'
import { sha256File, deriveKeyFromSignature, encryptFile } from '@/lib/crypto'

interface UploadedFile {
  id: string
  file: File
  preview: string
  type: 'image' | 'video' | 'audio'
  status: 'pending' | 'uploading' | 'compressed' | 'ready' | 'error' | 'warning'
  progress: number
  error?: string
  warning?: string
  needsCompression?: boolean
  duration?: number
  dimensions?: { width: number; height: number }
}

interface TypeFee {
  usd: number
  ada: number | null
  batch_usd: number        // total price for a batch of 5 (display)
  batch_per_usd: number   // per-keepsake fee when batching
  batch_per_ada: number | null
}

interface PriceInfo {
  service_fee_usd: number
  service_fee_ada: number | null
  ada_price_usd: number | null
  fees_by_type: { image: TypeFee; video: TypeFee; audio: TypeFee } | null
}

const MAX_FILES = 5

// Hard limits (will reject)
const MAX_SIZES = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 10 * 1024 * 1024, // 10MB
}

// Soft limits (will warn and suggest compression)
const RECOMMENDED_SIZES = {
  image: 5 * 1024 * 1024, // 5MB
  video: 25 * 1024 * 1024, // 25MB
  audio: 5 * 1024 * 1024, // 5MB
}

// Duration limits
const MAX_DURATION = {
  video: 60, // 60 seconds
  audio: 180, // 3 minutes (180 seconds)
}

// Dimension limits
const MAX_DIMENSIONS = {
  image: { width: 8000, height: 8000 },
  video: { width: 1920, height: 1080 },
}

const ACCEPTED_FORMATS = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff', 'image/x-tiff', 'image/avif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi', 'video/mpeg', 'video/x-matroska'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-flac'],
}

export default function MintPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [showCompressionModal, setShowCompressionModal] = useState(false)
  const [fileToCompress, setFileToCompress] = useState<string | null>(null)
  const [showMobileDataWarning, setShowMobileDataWarning] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'shared' | 'private'>('public')

  // Album fields
  const [albums, setAlbums] = useState<{ id: number; name: string; keepsakeIds: number[]; keepsakeCount: number }[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null)
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')

  const [sessionExpired, setSessionExpired] = useState(false)
  const [custodialLowBalance, setCustodialLowBalance] = useState(false)
  const [custodialWalletAddress, setCustodialWalletAddress] = useState('')

  // Minting state
  const [isMinting, setIsMinting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [mintStep, setMintStep] = useState('')
  const [mintError, setMintError] = useState('')
  const [mintResults, setMintResults] = useState<{ txHash: string; explorerUrl: string; title: string; status: 'confirmed' | 'pending' }[]>([])
  const [failedKeepsakeIds, setFailedKeepsakeIds] = useState<number[]>([])

  // Live price state
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null)
  const [isPriceLoading, setIsPriceLoading] = useState(true)
  const [priceError, setPriceError] = useState(false)

  // Pre-mint wallet balance warning (wallet users only)
  const [balanceWarning, setBalanceWarning] = useState('')

  const mintApiBase = () =>
    (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  const loadAlbums = async (token: string) => {
    try {
      const res = await fetch(`${mintApiBase()}/memorymint/v1/albums`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setAlbums(data.albums)
    } catch {}
  }

  const fetchPrice = () => {
    setPriceError(false)
    setIsPriceLoading(true)
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    fetch(`${apiBase}/memorymint/v1/mint/price`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPriceInfo({
            service_fee_usd: data.service_fee_usd,
            service_fee_ada: data.service_fee_ada ?? null,
            ada_price_usd: data.ada_price_usd ?? null,
            fees_by_type: data.fees_by_type ?? null,
          })
        } else {
          setPriceError(true)
        }
      })
      .catch(() => setPriceError(true))
      .finally(() => setIsPriceLoading(false))
  }

  useEffect(() => { fetchPrice() }, [])

  const createAlbum = async () => {
    if (!newAlbumName.trim()) return
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    try {
      const res = await fetch(`${mintApiBase()}/memorymint/v1/albums`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAlbumName.trim() }),
      })
      const data = await res.json()
      if (!data.success) return
      setAlbums((prev) => [...prev, data.album])
      setSelectedAlbumId(data.album.id)
      setNewAlbumName('')
      setShowNewAlbumInput(false)
    } catch {}
  }

  useEffect(() => {
    // Check if user is logged in
    const checkLoginStatus = () => {
      const walletConnected = sessionStorage.getItem('walletConnected') === 'true'
      const userEmail = sessionStorage.getItem('userEmail')
      // User is logged in if EITHER wallet is connected OR email is set
      const loggedIn = walletConnected || !!userEmail
      setIsLoggedIn(loggedIn)
    }

    // Check immediately
    checkLoginStatus()

    // Check every second for login status changes
    const interval = setInterval(checkLoginStatus, 1000)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [])

  // One-time token verification on mount — catches expired sessions before the user tries to mint.
  // For custodial users, also fires a balance check so low-ADA users are warned before they fill
  // out the mint form.
  useEffect(() => {
    const token = sessionStorage.getItem('mmToken')
    if (!token) return
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

    fetch(`${apiBase}/memorymint/v1/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) {
        sessionStorage.removeItem('mmToken')
        sessionStorage.removeItem('mmTokenExpiry')
        sessionStorage.removeItem('userEmail')
        setIsLoggedIn(false)
        setSessionExpired(true)
        return null
      }
      return r.json()
    }).then((data) => {
      // Load albums for any authenticated user
      loadAlbums(token)
      if (!data?.user?.is_custodial) return
      const walletAddress = data.user.wallet_address || ''
      if (walletAddress) setCustodialWalletAddress(walletAddress)
      // Best-effort balance pre-check — the build endpoint enforces this server-side too
      fetch(`${apiBase}/memorymint/v1/mint/wallet-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : null).then((bd) => {
        if (bd?.success && typeof bd.balance_ada === 'number' && bd.balance_ada < 2.5) {
          setCustodialLowBalance(true)
        }
      }).catch(() => null)
    }).catch(() => {})
  }, [])

  const getFileType = (file: File): 'image' | 'video' | 'audio' | null => {
    // First try MIME type
    if (ACCEPTED_FORMATS.image.includes(file.type)) return 'image'
    if (ACCEPTED_FORMATS.video.includes(file.type)) return 'video'
    if (ACCEPTED_FORMATS.audio.includes(file.type)) return 'audio'

    // Fallback: some browsers/OS report MIME types inconsistently (e.g. image/jpg vs image/jpeg)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif', 'avif'].includes(ext)) return 'image'
    if (['mp4', 'mov', 'webm', 'avi', 'mpeg', 'mpg', 'mkv'].includes(ext)) return 'video'
    if (['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio'

    return null
  }

  const formatFileSize = (bytes: number): string => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const getMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const element = file.type.startsWith('video/')
        ? document.createElement('video')
        : document.createElement('audio')

      element.preload = 'metadata'
      element.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(element.duration)
      }
      element.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read file metadata'))
      }
      element.src = url
    })
  }

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read image dimensions'))
      }
      img.src = url
    })
  }

  const validateFile = async (file: File): Promise<{
    valid: boolean
    error?: string
    warning?: string
    needsCompression?: boolean
    duration?: number
    dimensions?: { width: number; height: number }
  }> => {
    const fileType = getFileType(file)

    if (!fileType) {
      return {
        valid: false,
        error: `We can't use that file type. Please upload JPG, PNG, WEBP (photos) — MP4, MOV (video) — or MP3, M4A, WAV (audio).`
      }
    }

    // Check hard limit
    const maxSize = MAX_SIZES[fileType]
    if (file.size > maxSize) {
      const fileSizeMB = formatFileSize(file.size)
      const maxSizeMB = formatFileSize(maxSize)

      let errorTitle = ''
      let errorMessage = ''

      if (fileType === 'image') {
        errorTitle = 'That photo is a bit too large'
        errorMessage = `This photo is ${fileSizeMB}. Memory Mint supports photos up to ${maxSizeMB}. Try choosing a smaller photo, or let us compress it for you.`
      } else if (fileType === 'video') {
        errorTitle = 'That video is too large to upload'
        errorMessage = `This video is ${fileSizeMB}. Videos must be ${maxSizeMB} or less. Trim the video or export it in "Standard / 1080p" quality.`
      } else {
        errorTitle = 'That recording is too large'
        errorMessage = `This audio file is ${fileSizeMB}. Voice clips must be ${maxSizeMB} or less. Try a shorter clip or export as MP3/M4A.`
      }

      return { valid: false, error: `${errorTitle}: ${errorMessage}` }
    }

    let duration: number | undefined
    let dimensions: { width: number; height: number } | undefined
    let warning: string | undefined
    let needsCompression = false

    // Check dimensions for images (best-effort — if browser can't read it, allow through)
    if (fileType === 'image') {
      try {
        dimensions = await getImageDimensions(file)
        if (dimensions.width > MAX_DIMENSIONS.image.width || dimensions.height > MAX_DIMENSIONS.image.height) {
          return {
            valid: false,
            error: `Image dimensions too large (${dimensions.width}x${dimensions.height}). Maximum is ${MAX_DIMENSIONS.image.width}x${MAX_DIMENSIONS.image.height}. Please resize your image.`
          }
        }
      } catch {
        // Browser couldn't preview the image (HEIC, CMYK, unusual encoding, etc.)
        // Don't block — the file size check already guards against truly problematic files.
        // Just skip dimension info.
      }
    }

    // Check duration for video/audio (best-effort — if browser can't read it, allow through)
    if (fileType === 'video' || fileType === 'audio') {
      try {
        duration = await getMediaDuration(file)
        const maxDuration = MAX_DURATION[fileType]

        if (duration > maxDuration) {
          const durationStr = formatDuration(duration)
          const maxDurationStr = formatDuration(maxDuration)
          return {
            valid: false,
            error: `Let's keep it short: This ${fileType} is ${durationStr} long. The limit is ${maxDurationStr} for now. Please trim it down and try again.`
          }
        }
      } catch {
        // Browser couldn't read duration (unsupported codec, unusual format, etc.)
        // Don't block — the file will still upload fine on most platforms.
      }
    }

    // Check soft limit (warning but still allow)
    const recommendedSize = RECOMMENDED_SIZES[fileType]
    if (file.size > recommendedSize) {
      const fileSizeMB = formatFileSize(file.size)
      const recommendedMB = formatFileSize(recommendedSize)
      warning = fileType === 'image'
        ? `Upload might take a while: This photo is ${fileSizeMB}. For faster uploads, we recommend under ${recommendedMB}. We can compress it for you.`
        : `Upload might take a while: This file is ${fileSizeMB}. For faster uploads, we recommend under ${recommendedMB}. Consider trimming or compressing before uploading.`
      needsCompression = true
    }

    return { valid: true, warning, needsCompression, duration, dimensions }
  }

  const createFilePreview = (file: File, type: 'image' | 'video' | 'audio'): string => {
    if (type === 'image' || type === 'video') {
      return URL.createObjectURL(file)
    }
    return '' // Audio files don't need preview URL
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return

    const filesArray = Array.from(files)

    // Check max files limit
    if (uploadedFiles.length + filesArray.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files per mint. You currently have ${uploadedFiles.length} file(s) uploaded.`)
      return
    }

    const newFiles: UploadedFile[] = []

    for (const file of filesArray) {
      const validation = await validateFile(file)

      if (!validation.valid) {
        alert(`${file.name}:\n\n${validation.error}`)
        continue
      }

      const fileType = getFileType(file)!
      const preview = createFilePreview(file, fileType)

      const uploadedFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        type: fileType,
        status: validation.warning ? 'warning' : 'pending',
        progress: 0,
        warning: validation.warning,
        needsCompression: validation.needsCompression,
        duration: validation.duration,
        dimensions: validation.dimensions,
      }

      newFiles.push(uploadedFile)
    }

    setUploadedFiles([...uploadedFiles, ...newFiles])

    // Only auto-process files that don't need compression.
    // Files with needsCompression stay at 'warning' status so the user
    // can decide to compress or continue with the original.
    newFiles.forEach((uploadedFile) => {
      if (!uploadedFile.needsCompression) {
        simulateProcessing(uploadedFile.id)
      }
    })
  }

  const simulateProcessing = (fileId: string) => {
    // Show a brief processing animation for non-compression files
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: 'uploading' as const }
          : f
      )
    )

    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 30
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'ready' as const, progress: 100 }
              : f
          )
        )
      } else {
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
        )
      }
    }, 300)
  }

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const canvas = document.createElement('canvas')
        let width = img.naturalWidth
        let height = img.naturalHeight

        // Scale down if either dimension exceeds 3840px
        const maxDim = 3840
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, width, height)

        // Iteratively reduce JPEG quality until under the recommended size
        let quality = 0.85
        const targetBytes = RECOMMENDED_SIZES.image
        const tryBlob = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Compression failed')); return }
              if (blob.size <= targetBytes || quality < 0.3) {
                const name = file.name.replace(/\.[^.]+$/, '.jpg')
                resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }))
              } else {
                quality -= 0.1
                tryBlob()
              }
            },
            'image/jpeg',
            quality
          )
        }
        tryBlob()
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not load image for compression'))
      }

      img.src = objectUrl
    })
  }

  const handleCompressFile = async (fileId: string) => {
    setShowCompressionModal(false)
    setFileToCompress(null)

    const target = uploadedFiles.find((f) => f.id === fileId)
    if (!target) return

    if (target.type === 'image' && target.file.type !== 'image/gif') {
      // Show processing state with incremental fake progress while Canvas compresses.
      // GIFs are skipped because Canvas only captures the first frame (breaks animation).
      setUploadedFiles((prev) =>
        prev.map((f) => f.id === fileId ? { ...f, status: 'uploading' as const, progress: 0, warning: undefined } : f)
      )

      let fakeProgress = 0
      const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + 15, 85)
        setUploadedFiles((prev) =>
          prev.map((f) => f.id === fileId ? { ...f, progress: fakeProgress } : f)
        )
      }, 200)

      try {
        const compressed = await compressImage(target.file)
        clearInterval(progressInterval)

        // Revoke the old blob URL to free memory
        if (target.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview)
        const newPreview = URL.createObjectURL(compressed)

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, file: compressed, preview: newPreview, needsCompression: false, status: 'ready' as const, progress: 100 }
              : f
          )
        )
      } catch {
        clearInterval(progressInterval)
        // Compression failed — just mark ready with the original file
        setUploadedFiles((prev) =>
          prev.map((f) => f.id === fileId ? { ...f, status: 'ready' as const, progress: 100, warning: undefined } : f)
        )
      }
    } else {
      // GIF, video, and audio can't be safely compressed in the browser — just mark ready
      simulateProcessing(fileId)
    }
  }

  const handleContinueWithoutCompression = (fileId: string) => {
    setShowCompressionModal(false)
    setFileToCompress(null)
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: 'ready' as const, progress: 100, needsCompression: false, warning: undefined }
          : f
      )
    )
  }

  const removeFile = (fileId: string) => {
    const file = uploadedFiles.find((f) => f.id === fileId)
    if (file && file.preview) {
      URL.revokeObjectURL(file.preview)
    }
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isLoggedIn) {
      return
    }
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!isLoggedIn) {
      setShowLoginPrompt(true)
      return
    }
    handleFiles(e.dataTransfer.files)
  }

  const handleUploadClick = () => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true)
      return
    }
    fileInputRef.current?.click()
  }

  const checkMobileDataWarning = () => {
    // Check if on mobile and has large files
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection && (connection.effectiveType === '3g' || connection.effectiveType === '2g' || connection.saveData)) {
        const totalSize = uploadedFiles.reduce((sum, f) => sum + f.file.size, 0)
        if (totalSize > 10 * 1024 * 1024) { // > 10MB total
          return true
        }
      }
    }
    return false
  }

  // Polls GET /mint/status/{txHash} every 5s for up to 2 minutes
  const pollTxStatus = async (
    apiBase: string,
    txHash: string,
    onProgress: (attempt: number) => void,
    maxAttempts = 24,
  ): Promise<{ status: 'confirmed' | 'failed' | 'timeout'; explorerUrl?: string }> => {
    for (let i = 1; i <= maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      onProgress(i)
      try {
        const res = await fetch(`${apiBase}/memorymint/v1/mint/status/${txHash}`)
        const data = await res.json()
        if (data.success) {
          if (data.status === 'confirmed') return { status: 'confirmed', explorerUrl: data.explorer_url }
          if (data.status === 'failed')    return { status: 'failed' }
        }
      } catch { /* network hiccup — keep polling */ }
    }
    return { status: 'timeout' }
  }

  const handleMint = async () => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true)
      return
    }

    if (uploadedFiles.length === 0) {
      alert('Please upload at least one file')
      return
    }

    if (!title.trim()) {
      alert('Please enter a title for your memory')
      return
    }

    const allReady = uploadedFiles.every((f) => f.status === 'ready' || f.status === 'warning')
    if (!allReady) {
      alert('Please wait for all files to finish processing, or compress large files before minting.')
      return
    }

    // Check for mobile data warning
    if (checkMobileDataWarning()) {
      setShowMobileDataWarning(true)
      return
    }

    const mmToken = sessionStorage.getItem('mmToken')

    if (!mmToken) {
      alert('Please log in to mint your memory.')
      return
    }

    // Balance check — browser wallet users only (email users are funded by policy wallet)
    const mmWalletKey = sessionStorage.getItem('mmWalletKey')
    if (mmWalletKey && priceInfo) {
      try {
        const walletApi = await connectWallet(mmWalletKey)
        const balanceAda = parseFloat(await getWalletBalance(walletApi))
        // Compute total service fee using batch rates where applicable
        const typeCounts = uploadedFiles.reduce((acc, f) => {
          acc[f.type] = (acc[f.type] || 0) + 1; return acc
        }, {} as Record<string, number>)
        const totalFeeAda = uploadedFiles.reduce((sum, f) => {
          const isBatch = typeCounts[f.type] >= 5
          const feeInfo = priceInfo.fees_by_type?.[f.type]
          const fee = feeInfo
            ? (isBatch ? (feeInfo.batch_per_ada ?? feeInfo.ada ?? 0) : (feeInfo.ada ?? 0))
            : (priceInfo.service_fee_ada ?? 0)
          return sum + fee
        }, 0)
        const requiredAda = totalFeeAda + 2.5
        if (balanceAda < requiredAda) {
          setBalanceWarning(
            `Not enough ADA — you need at least ${requiredAda.toFixed(2)} ADA but your wallet has ${balanceAda.toFixed(2)} ADA. Please top up and try again.`
          )
          return
        }
        setBalanceWarning('')
      } catch {
        // Balance check failed (e.g. wallet disconnected) — proceed and let signing surface the real error
      }
    }

    // All checks passed — show confirmation modal before committing
    setShowConfirmModal(true)
  }

  const proceedWithMint = async () => {
    setShowMobileDataWarning(false)
    const mmToken = sessionStorage.getItem('mmToken')
    if (!mmToken) {
      alert('Please log in to mint your memory.')
      return
    }
    await executeMint(mmToken)
  }

  const executeMint = async (token: string) => {
    setIsMinting(true)
    setMintError('')
    setBalanceWarning('')
    setMintResults([])
    setFailedKeepsakeIds([])

    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    const authHeaders = { Authorization: `Bearer ${token}` }
    const mmWalletKey = sessionStorage.getItem('mmWalletKey')
    const results: { txHash: string; explorerUrl: string; title: string; status: 'confirmed' | 'pending' }[] = []
    const mintedKeepsakeIds: number[] = []
    let currentKeepsakeId: number | null = null

    // Count files per type so the backend can apply batch pricing when all 5 are the same type
    const batchTypeCounts = uploadedFiles.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1; return acc
    }, {} as Record<string, number>)

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uf = uploadedFiles[i]
        const fileTitle = uploadedFiles.length > 1 ? `${title} (${i + 1}/${uploadedFiles.length})` : title

        // Step 0: Encrypt file client-side for private keepsakes (wallet users only)
        let fileToUpload: File | Blob = uf.file
        let originalContentHash: string | null = null
        let isEncrypted = false

        if (privacy === 'private' && mmWalletKey) {
          setMintStep(`Encrypting file ${i + 1} of ${uploadedFiles.length}...`)
          try {
            const walletApi = await connectWallet(mmWalletKey)
            const addressHex: string = await walletApi.getChangeAddress()
            originalContentHash = await sha256File(uf.file)
            const sigHex = await signDataForKey(walletApi, addressHex, `memorymint:decrypt:v1:${originalContentHash}`)
            const cek = await deriveKeyFromSignature(sigHex)
            fileToUpload = await encryptFile(uf.file, cek)
            isEncrypted = true
          } catch {
            throw new Error('Encryption failed. Make sure your wallet is connected and approve the signing request.')
          }
        }

        // Step 1: Upload file to WordPress
        setMintStep(`Uploading file ${i + 1} of ${uploadedFiles.length}...`)
        const formData = new FormData()
        formData.append('file', fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], uf.file.name, { type: 'application/octet-stream' }))

        const uploadRes = await fetch(`${apiBase}/memorymint/v1/upload`, {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        })
        const uploadData = await uploadRes.json()

        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(`Upload failed: ${uploadData.error || 'Unknown error'}`)
        }

        const attachmentId: number = uploadData.attachment_id

        // Step 2: Create keepsake record
        setMintStep(`Creating keepsake ${i + 1} of ${uploadedFiles.length}...`)
        const keepsakeRes = await fetch(`${apiBase}/memorymint/v1/keepsakes`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: fileTitle,
            description,
            privacy,
            file_attachment_id: attachmentId,
            ...(isEncrypted && { is_encrypted: true, content_hash: originalContentHash }),
          }),
        })
        const keepsakeData = await keepsakeRes.json()

        if (!keepsakeRes.ok || !keepsakeData.success) {
          throw new Error(`Failed to create keepsake: ${keepsakeData.error || 'Unknown error'}`)
        }

        const keepsakeId: number = keepsakeData.keepsake.id
        currentKeepsakeId = keepsakeId
        mintedKeepsakeIds.push(keepsakeId)

        // Step 3: Build transaction
        setMintStep(`Building transaction ${i + 1} of ${uploadedFiles.length}...`)
        const buildRes = await fetch(`${apiBase}/memorymint/v1/mint/build`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ keepsake_id: keepsakeId, batch_count: batchTypeCounts[uf.type] || 1 }),
        })
        const buildData = await buildRes.json()

        if (!buildRes.ok || !buildData.success) {
          throw new Error(`Failed to build transaction: ${buildData.error || 'Unknown error'}`)
        }

        const unsignedTx: string = buildData.unsigned_tx

        // Step 4: Sign and submit — branch on wallet type
        setMintStep(`Minting memory ${i + 1} of ${uploadedFiles.length} to blockchain...`)

        let signData: any

        if (mmWalletKey) {
          // Browser wallet user — reconnect and sign with their wallet extension
          let walletApi: any
          try {
            walletApi = await connectWallet(mmWalletKey)
          } catch {
            throw new Error('Could not reconnect your wallet. Please refresh and try again.')
          }

          let witnessHex: string
          try {
            // CIP-30: signTx(txHex, partialSign=true) returns the witness set only
            witnessHex = await walletApi.signTx(unsignedTx, true)
          } catch (e: any) {
            throw new Error(`Wallet signing was cancelled or failed: ${e?.message || 'Unknown error'}`)
          }

          const signRes = await fetch(`${apiBase}/memorymint/v1/mint/sign`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keepsake_id: keepsakeId, witness: witnessHex, unsigned_tx: unsignedTx }),
          })
          signData = await signRes.json()

          if (!signRes.ok || !signData.success) {
            throw new Error(`Minting failed: ${signData.error || 'Unknown error'}`)
          }
        } else {
          // Email user — server-side custodial signing
          const signRes = await fetch(`${apiBase}/memorymint/v1/mint/custodial-sign`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keepsake_id: keepsakeId, unsigned_tx: unsignedTx }),
          })
          signData = await signRes.json()

          if (!signRes.ok || !signData.success) {
            throw new Error(`Minting failed: ${signData.error || 'Unknown error'}`)
          }
        }

        // Poll for on-chain confirmation (up to 2 minutes)
        setMintStep(`Confirming on blockchain...`)
        const pollResult = await pollTxStatus(
          apiBase,
          signData.tx_hash,
          (attempt) => setMintStep(`Confirming on blockchain... (${attempt}/24)`),
        )

        if (pollResult.status === 'failed') {
          throw new Error('Transaction was rejected by the blockchain. Please try again.')
        }

        results.push({
          txHash: signData.tx_hash,
          explorerUrl: pollResult.explorerUrl || signData.explorer_url,
          title: fileTitle,
          status: pollResult.status === 'confirmed' ? 'confirmed' : 'pending',
        })
      }

      setMintResults(results)
      setMintStep('')

      // Assign successfully minted keepsakes to the selected album
      if (selectedAlbumId !== null && mintedKeepsakeIds.length > 0) {
        try {
          await fetch(`${mintApiBase()}/memorymint/v1/albums/${selectedAlbumId}/keepsakes`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keepsake_ids: mintedKeepsakeIds }),
          })
          setAlbums((prev) => prev.map((a) =>
            a.id === selectedAlbumId
              ? { ...a, keepsakeIds: [...new Set([...a.keepsakeIds, ...mintedKeepsakeIds])], keepsakeCount: a.keepsakeCount + mintedKeepsakeIds.length }
              : a
          ))
        } catch {}
      }

    } catch (err: any) {
      setMintError(err.message || 'An unexpected error occurred during minting.')
      setMintStep('')
      // Track which keepsake failed so the user can retry it
      if (currentKeepsakeId !== null) {
        setFailedKeepsakeIds((prev) => [...prev, currentKeepsakeId as number])
      }
    } finally {
      setIsMinting(false)
    }
  }

  const handleRetryMint = async () => {
    if (failedKeepsakeIds.length === 0) return
    const mmToken = sessionStorage.getItem('mmToken')
    if (!mmToken) { alert('Please log in to retry.'); return }

    setIsMinting(true)
    setMintError('')

    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    const authHeaders = { Authorization: `Bearer ${mmToken}`, 'Content-Type': 'application/json' }
    const retryIds = [...failedKeepsakeIds]
    setFailedKeepsakeIds([])

    try {
      for (const keepsakeId of retryIds) {
        // Reset the keepsake server-side so it can be rebuilt
        const resetRes = await fetch(`${apiBase}/memorymint/v1/mint/retry/${keepsakeId}`, {
          method: 'POST', headers: authHeaders,
        })
        if (!resetRes.ok) throw new Error('Failed to reset keepsake for retry.')

        // Re-run only the build + sign + submit steps (upload/keepsake already exist)
        setMintStep(`Rebuilding transaction for keepsake #${keepsakeId}...`)
        const buildRes = await fetch(`${apiBase}/memorymint/v1/mint/build`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ keepsake_id: keepsakeId }),
        })
        const buildData = await buildRes.json()
        if (!buildRes.ok || !buildData.success) {
          throw new Error(`Failed to build transaction: ${buildData.error || 'Unknown error'}`)
        }

        const unsignedTx: string = buildData.unsigned_tx
        setMintStep(`Minting keepsake #${keepsakeId} to blockchain...`)

        const mmWalletKey = sessionStorage.getItem('mmWalletKey')
        let signData: any

        if (mmWalletKey) {
          let walletApi: any
          try { walletApi = await connectWallet(mmWalletKey) } catch {
            throw new Error('Could not reconnect your wallet. Please refresh and try again.')
          }
          let witnessHex: string
          try { witnessHex = await walletApi.signTx(unsignedTx, true) } catch (e: any) {
            throw new Error(`Wallet signing was cancelled or failed: ${e?.message || 'Unknown error'}`)
          }
          const signRes = await fetch(`${apiBase}/memorymint/v1/mint/sign`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ keepsake_id: keepsakeId, witness: witnessHex, unsigned_tx: unsignedTx }),
          })
          signData = await signRes.json()
          if (!signRes.ok || !signData.success) throw new Error(`Minting failed: ${signData.error || 'Unknown error'}`)
        } else {
          const signRes = await fetch(`${apiBase}/memorymint/v1/mint/custodial-sign`, {
            method: 'POST', headers: authHeaders,
            body: JSON.stringify({ keepsake_id: keepsakeId, unsigned_tx: unsignedTx }),
          })
          signData = await signRes.json()
          if (!signRes.ok || !signData.success) throw new Error(`Minting failed: ${signData.error || 'Unknown error'}`)
        }

        // Poll for on-chain confirmation
        setMintStep(`Confirming on blockchain...`)
        const pollResult = await pollTxStatus(
          apiBase,
          signData.tx_hash,
          (attempt) => setMintStep(`Confirming on blockchain... (${attempt}/24)`),
        )

        if (pollResult.status === 'failed') {
          throw new Error('Transaction was rejected by the blockchain. Please try again.')
        }

        setMintResults((prev) => [...prev, {
          txHash: signData.tx_hash,
          explorerUrl: pollResult.explorerUrl || signData.explorer_url,
          title: `Keepsake #${keepsakeId}`,
          status: pollResult.status === 'confirmed' ? 'confirmed' : 'pending',
        }])
      }
      setMintStep('')
    } catch (err: any) {
      setMintError(err.message || 'Retry failed.')
      setMintStep('')
    } finally {
      setIsMinting(false)
    }
  }

  const handleDiscardFailed = async () => {
    const mmToken = sessionStorage.getItem('mmToken')
    if (!mmToken || failedKeepsakeIds.length === 0) return
    const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
    for (const id of failedKeepsakeIds) {
      try {
        await fetch(`${apiBase}/memorymint/v1/keepsakes/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mmToken}` },
        })
      } catch { /* silent — record may already be gone */ }
    }
    setFailedKeepsakeIds([])
    setMintError('')
  }

  const allFilesReady = uploadedFiles.length > 0 && uploadedFiles.every((f) => f.status === 'ready' || f.status === 'warning')

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Mint Your Memory
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Upload photos, videos, or audio. Add a message. Preserve it forever on the blockchain.
        </p>
      </motion.div>

      {/* Custodial low-balance warning — shown before user fills out the form */}
      {custodialLowBalance && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-orange-50 border-2 border-orange-300 rounded-2xl px-5 py-4"
        >
          <p className="font-semibold text-orange-900 mb-1">⚠️ Your wallet needs ADA before you can mint</p>
          <p className="text-sm text-orange-800 mb-2">
            Each mint requires at least <strong>2.5 ADA</strong> in your wallet to cover the Cardano network fee.
            Send ADA to your wallet address first.
          </p>
          {custodialWalletAddress && (
            <code className="block bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 break-all">
              {custodialWalletAddress}
            </code>
          )}
        </motion.div>
      )}

      {/* Session Expired Banner */}
      {sessionExpired && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">⏰</span>
            <div>
              <p className="font-semibold text-red-900">Your session has expired</p>
              <p className="text-sm text-red-800">Please log in again to continue minting.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Login Prompt */}
      {!isLoggedIn && !sessionExpired && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <p className="font-semibold text-amber-900">Login required to upload</p>
              <p className="text-sm text-amber-800">
                Click the "Login" button in the top-right corner to connect your Cardano wallet and start minting memories.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
          className={`
            border-3 border-dashed rounded-3xl p-12 text-center transition-all duration-300
            ${!isLoggedIn
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : isDragging
                ? 'border-mint-gold bg-amber-50 scale-[1.02] cursor-pointer'
                : 'border-gray-300 bg-white hover:border-mint-gold hover:bg-gray-50 cursor-pointer'
            }
          `}
        >
          <div className="text-6xl mb-4">{!isLoggedIn ? '🔒' : '📤'}</div>
          <h3 className="text-2xl font-semibold mb-2 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            {!isLoggedIn ? 'Login to upload files' : 'Drop files here or click to upload'}
          </h3>
          <p className="text-gray-600 mb-4">
            {!isLoggedIn
              ? 'Connect your wallet to start uploading memories'
              : `Upload up to ${MAX_FILES} files (images, videos, or audio)`
            }
          </p>
          {isLoggedIn && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm text-gray-500">
              <span>📸 Images: JPG, PNG, WEBP, GIF, BMP, TIFF &amp; more (max 10MB)</span>
              <span className="hidden sm:inline">•</span>
              <span>🎥 Video: MP4, MOV, WEBM, AVI &amp; more (max 50MB, 60s)</span>
              <span className="hidden sm:inline">•</span>
              <span>🎵 Audio: MP3, M4A, WAV, FLAC &amp; more (max 10MB, 3min)</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={[...ACCEPTED_FORMATS.image, ...ACCEPTED_FORMATS.video, ...ACCEPTED_FORMATS.audio].join(',')}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      </motion.div>

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
              Uploaded Files ({uploadedFiles.length}/{MAX_FILES})
            </h2>
            {uploadedFiles.length < MAX_FILES && isLoggedIn && (
              <button
                onClick={handleUploadClick}
                className="text-mint-gold hover:text-amber-600 font-medium"
              >
                + Add more files
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {uploadedFiles.map((uploadedFile) => (
                <motion.div
                  key={uploadedFile.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg"
                >
                  {/* Preview */}
                  <div className="relative h-48 bg-gray-100">
                    {uploadedFile.type === 'image' && uploadedFile.preview && (
                      <Image
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        fill
                        className="object-cover"
                      />
                    )}
                    {uploadedFile.type === 'video' && uploadedFile.preview && (
                      <video
                        src={uploadedFile.preview}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    {uploadedFile.type === 'audio' && (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-6xl">🎵</span>
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFile(uploadedFile.id)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
                    >
                      ×
                    </button>

                    {/* Status Badge */}
                    <div className="absolute bottom-2 left-2">
                      {uploadedFile.status === 'uploading' && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {uploadedFile.needsCompression ? 'Compressing...' : 'Processing...'}
                        </span>
                      )}
                      {uploadedFile.status === 'ready' && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          ✓ Ready
                        </span>
                      )}
                      {uploadedFile.status === 'warning' && (
                        <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                          ⚠ Large file
                        </span>
                      )}
                      {uploadedFile.status === 'error' && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="p-4">
                    <p className="font-medium text-gray-800 truncate mb-1">
                      {uploadedFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <span>{formatFileSize(uploadedFile.file.size)}</span>
                      {uploadedFile.duration && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(uploadedFile.duration)}</span>
                        </>
                      )}
                      {uploadedFile.dimensions && (
                        <>
                          <span>•</span>
                          <span>{uploadedFile.dimensions.width}x{uploadedFile.dimensions.height}</span>
                        </>
                      )}
                    </div>

                    {/* Warning Message */}
                    {uploadedFile.warning && uploadedFile.status === 'warning' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                        <p className="text-xs text-amber-800 leading-relaxed mb-2">
                          {uploadedFile.warning}
                        </p>
                        <div className="flex gap-2">
                          {uploadedFile.type === 'image' &&
                           uploadedFile.file.type !== 'image/gif' &&
                           !/\.(heic|heif)$/i.test(uploadedFile.file.name) && (
                            <button
                              onClick={() => handleCompressFile(uploadedFile.id)}
                              className="flex-1 bg-mint-gold hover:bg-amber-500 text-gray-800 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                            >
                              Compress Now
                            </button>
                          )}
                          <button
                            onClick={() => handleContinueWithoutCompression(uploadedFile.id)}
                            className="flex-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-lg border border-gray-300 transition-colors"
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {uploadedFile.status === 'uploading' && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-mint-gold h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Memory Details Form */}
      {uploadedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-8 shadow-lg mb-8"
        >
          <h2 className="text-2xl font-semibold mb-6 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Add Details
          </h2>

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your memory a title"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-mint-gold focus:outline-none transition-colors"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share the story behind this memory"
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-mint-gold focus:outline-none transition-colors resize-none"
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-1">
              {description.length}/500 characters
            </p>
          </div>

          {/* Privacy Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Privacy Level *
            </label>
            <div className="grid md:grid-cols-3 gap-4">
              <button
                onClick={() => setPrivacy('public')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  privacy === 'public'
                    ? 'border-mint-gold bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🌍</div>
                <p className="font-semibold text-gray-800">Public</p>
                <p className="text-sm text-gray-600">
                  Anyone can view this memory
                </p>
              </button>

              <button
                onClick={() => setPrivacy('shared')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  privacy === 'shared'
                    ? 'border-mint-gold bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">👥</div>
                <p className="font-semibold text-gray-800">Shared</p>
                <p className="text-sm text-gray-600">
                  Only people with the link
                </p>
              </button>

              <button
                onClick={() => setPrivacy('private')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  privacy === 'private'
                    ? 'border-mint-gold bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🔐</div>
                <p className="font-semibold text-gray-800">Private</p>
                <p className="text-sm text-gray-600">
                  Only you can view (Midnight)
                </p>
              </button>
            </div>
          </div>

          {/* Midnight Notice for Private */}
          {privacy === 'private' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <img src="/midnight-logo.png" alt="Midnight" className="w-5 h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <div>
                  <p className="font-medium text-purple-900">Midnight Privacy Active</p>
                  <p className="text-sm text-purple-800">
                    Your sensitive memory details will be encrypted using Midnight's privacy protocol.
                    Proof of existence remains on Cardano, but content stays private.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Album Selection */}
          <div className="border-t border-gray-100 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              📁 Add to Album <span className="text-gray-400 font-normal">(optional)</span>
            </label>

            <div className="space-y-2 mb-3">
              {/* No album option */}
              <button
                onClick={() => setSelectedAlbumId(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                  selectedAlbumId === null
                    ? 'border-mint-gold bg-amber-50 text-gray-800'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🚫</span>
                  <span className="font-medium">No Album</span>
                </span>
                {selectedAlbumId === null && <span className="text-mint-gold font-bold">✓</span>}
              </button>

              {/* Existing albums */}
              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                    selectedAlbumId === album.id
                      ? 'border-mint-gold bg-amber-50 text-gray-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📁</span>
                    <span className="font-medium">{album.name}</span>
                    <span className="text-gray-400">({album.keepsakeCount} keepsake{album.keepsakeCount !== 1 ? 's' : ''})</span>
                  </span>
                  {selectedAlbumId === album.id && <span className="text-mint-gold font-bold">✓</span>}
                </button>
              ))}
            </div>

            {/* Create new album */}
            {showNewAlbumInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createAlbum()}
                  placeholder="Album name..."
                  autoFocus
                  className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-mint-gold focus:outline-none text-sm"
                />
                <button
                  onClick={createAlbum}
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
        </motion.div>
      )}

      {/* Mint Button */}
      {uploadedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          {/* Pricing Summary */}
          <div className="inline-block mb-6">
            {isPriceLoading ? (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-8 py-4">
                <p className="text-amber-600 text-sm">Loading pricing...</p>
              </div>
            ) : priceInfo ? (
              (() => {
                const typeCounts = uploadedFiles.reduce((acc, f) => {
                  acc[f.type] = (acc[f.type] || 0) + 1; return acc
                }, {} as Record<string, number>)
                const isBatchOf5 = uploadedFiles.length === 5 && Object.keys(typeCounts).length === 1
                const totalUsd = uploadedFiles.reduce((sum, f) => {
                  const feeInfo = priceInfo.fees_by_type?.[f.type]
                  const isBatch = (typeCounts[f.type] || 0) >= 5
                  const fee = feeInfo
                    ? (isBatch ? feeInfo.batch_per_usd : feeInfo.usd)
                    : priceInfo.service_fee_usd
                  return sum + fee
                }, 0)
                const totalAda = uploadedFiles.reduce((sum, f) => {
                  const feeInfo = priceInfo.fees_by_type?.[f.type]
                  const isBatch = (typeCounts[f.type] || 0) >= 5
                  const fee = feeInfo
                    ? (isBatch ? (feeInfo.batch_per_ada ?? feeInfo.ada ?? 0) : (feeInfo.ada ?? 0))
                    : (priceInfo.service_fee_ada ?? 0)
                  return sum + fee
                }, 0)
                const hasAda = totalAda > 0
                return (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-8 py-4">
                    <p className="text-amber-900 font-semibold text-lg">
                      {uploadedFiles.length} keepsake{uploadedFiles.length > 1 ? 's' : ''} —{' '}
                      <span className="text-amber-700">${totalUsd.toFixed(2)} USD</span>
                      {isBatchOf5 && (
                        <span className="ml-2 text-sm font-normal text-green-600">Batch rate applied</span>
                      )}
                    </p>
                    {hasAda && (
                      <p className="text-amber-600 text-sm mt-0.5">
                        ≈ {totalAda.toFixed(2)} ADA
                        {priceInfo.ada_price_usd !== null && (
                          <span className="text-amber-500"> · 1 ADA = ${priceInfo.ada_price_usd.toFixed(4)}</span>
                        )}
                      </p>
                    )}
                  </div>
                )
              })()
            ) : priceError ? (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-8 py-4">
                <p className="text-red-800 font-semibold">Could not load pricing</p>
                <p className="text-red-600 text-sm mt-0.5 mb-3">Check your connection and try again.</p>
                <button
                  onClick={fetchPrice}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-1.5 rounded-lg transition-all"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-8 py-4">
                <p className="text-amber-900 font-semibold text-lg">
                  {uploadedFiles.length} keepsake{uploadedFiles.length > 1 ? 's' : ''}
                </p>
                <p className="text-amber-600 text-sm mt-0.5">Price unavailable — contact support</p>
              </div>
            )}
          </div>

          <br />

          {/* Minting progress */}
          {isMinting && (
            <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl px-8 py-5 text-center">
              <div className="text-2xl mb-2 animate-spin inline-block">⚙️</div>
              <p className="text-amber-800 font-semibold">{mintStep || 'Preparing...'}</p>
              <p className="text-amber-600 text-sm mt-1">Do not close this page.</p>
            </div>
          )}

          {/* Minting error */}
          {mintError && !isMinting && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl px-8 py-5 text-center">
              <p className="text-red-700 font-semibold">
                {/cancel|declined|denied|reject/i.test(mintError)
                  ? 'Signing cancelled'
                  : failedKeepsakeIds.length > 0
                  ? 'Minting stopped'
                  : 'Minting failed'}
              </p>
              <p className="text-red-600 text-sm mt-1">{mintError}</p>
              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                {failedKeepsakeIds.length > 0 && (
                  <button
                    onClick={handleRetryMint}
                    className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
                  >
                    Retry Mint
                  </button>
                )}
                {failedKeepsakeIds.length > 0 && (
                  <button
                    onClick={handleDiscardFailed}
                    className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
                  >
                    Discard
                  </button>
                )}
                <button onClick={() => { setMintError(''); setFailedKeepsakeIds([]) }} className="text-xs text-red-500 underline self-center">Dismiss</button>
              </div>
            </div>
          )}

          {/* Minting success */}
          {mintResults.length > 0 && !isMinting && (
            <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-2xl px-8 py-5 text-center">
              <div className="text-3xl mb-2">{mintResults.every(r => r.status === 'confirmed') ? '🎉' : '⏳'}</div>
              <p className="text-green-800 font-semibold text-lg">
                {mintResults.every(r => r.status === 'confirmed')
                  ? 'Confirmed on the blockchain!'
                  : 'Transaction submitted — confirmation pending'}
              </p>
              {mintResults.map((r, i) => (
                <div key={i} className="mt-3">
                  <p className="text-green-700 text-sm font-medium">{r.title}</p>
                  {r.status === 'confirmed'
                    ? <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-green-600 underline break-all">
                        View on Cardanoscan →
                      </a>
                    : <span className="text-xs text-amber-600">
                        Waiting for block confirmation —{' '}
                        <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          check explorer
                        </a>
                      </span>
                  }
                </div>
              ))}
            </div>
          )}

          {balanceWarning && (
            <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-2xl px-6 py-4 text-center">
              <p className="text-amber-800 font-semibold text-sm">⚠ Insufficient balance</p>
              <p className="text-amber-700 text-sm mt-1">{balanceWarning}</p>
            </div>
          )}

          <motion.button
            whileHover={{ scale: allFilesReady && !isMinting ? 1.05 : 1 }}
            whileTap={{ scale: allFilesReady && !isMinting ? 0.95 : 1 }}
            onClick={handleMint}
            disabled={!allFilesReady || isMinting}
            className={`
              px-12 py-5 rounded-2xl font-semibold text-lg shadow-lg transition-all
              ${allFilesReady && !isMinting
                ? 'bg-mint-gold hover:bg-amber-500 text-gray-800 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isMinting ? '⏳ Minting...' : allFilesReady ? '✨ Mint to Blockchain' : '⏳ Processing files...'}
          </motion.button>

          {!isLoggedIn && (
            <p className="text-sm text-gray-600 mt-4">
              You'll be prompted to log in when you click Mint
            </p>
          )}
        </motion.div>
      )}

      {/* Login Prompt Modal */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLoginPrompt(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">🔐</div>
                <h2 className="text-3xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  Login Required
                </h2>
                <p className="text-gray-600 mb-4">
                  Please connect your wallet to start uploading and minting your memories.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowLoginPrompt(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    Got it
                  </button>
                  <button
                    onClick={() => { setShowLoginPrompt(false); setShowLoginModal(true) }}
                    className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    🔗 Login
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(type, data) => {
          if (type === 'wallet') {
            sessionStorage.setItem('walletConnected', 'true')
          } else if (type === 'email') {
            sessionStorage.setItem('userEmail', data.email)
          }
          setShowLoginModal(false)
          setIsLoggedIn(true)
        }}
      />

      {/* Mobile Data Warning Modal */}
      <AnimatePresence>
        {showMobileDataWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileDataWarning(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">📱</div>
                <h2 className="text-3xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  Large Upload on Mobile
                </h2>
                <p className="text-gray-600 mb-4">
                  You're on mobile data. Uploading {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0))} may take a while and use your data plan.
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  Consider waiting for Wi-Fi or compressing your files first.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowMobileDataWarning(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    Wait for Wi-Fi
                  </button>
                  <button
                    onClick={proceedWithMint}
                    className="flex-1 bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
                  >
                    Upload Anyway
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mint Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8"
            >
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">✨</div>
                <h2 className="text-3xl font-bold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  Confirm your mint
                </h2>
                <p className="text-gray-500 text-sm mt-1">This action is permanent and cannot be undone.</p>
              </div>

              {/* Files summary */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
                {uploadedFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate max-w-[220px]" title={f.file.name}>
                      {f.type === 'image' ? '🖼' : f.type === 'video' ? '🎬' : '🎵'} {f.file.name}
                    </span>
                    <span className="text-gray-500 shrink-0 ml-2">
                      {privacy === 'public' ? '🌍' : privacy === 'shared' ? '👥' : '🔐'} {privacy}
                    </span>
                  </div>
                ))}
              </div>

              {/* Title */}
              <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4 text-sm text-gray-700">
                <span className="text-gray-400 mr-2">Title:</span>
                <strong>{title}</strong>
              </div>

              {/* Fee summary */}
              {priceInfo && (() => {
                const typeCounts = uploadedFiles.reduce((acc, f) => {
                  acc[f.type] = (acc[f.type] || 0) + 1; return acc
                }, {} as Record<string, number>)
                const totalUsd = uploadedFiles.reduce((sum, f) => {
                  const feeInfo = priceInfo.fees_by_type?.[f.type]
                  const isBatch = (typeCounts[f.type] || 0) >= 5
                  return sum + (feeInfo ? (isBatch ? feeInfo.batch_per_usd : feeInfo.usd) : priceInfo.service_fee_usd)
                }, 0)
                const totalAda = uploadedFiles.reduce((sum, f) => {
                  const feeInfo = priceInfo.fees_by_type?.[f.type]
                  const isBatch = (typeCounts[f.type] || 0) >= 5
                  return sum + (feeInfo ? (isBatch ? (feeInfo.batch_per_ada ?? feeInfo.ada ?? 0) : (feeInfo.ada ?? 0)) : (priceInfo.service_fee_ada ?? 0))
                }, 0)
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between text-sm">
                    <span className="text-amber-700">Service fee</span>
                    <span className="font-semibold text-amber-900">
                      ${totalUsd.toFixed(2)} USD {totalAda > 0 ? `≈ ${totalAda.toFixed(4)} ADA` : ''}
                    </span>
                  </div>
                )
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  Go Back
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmModal(false)
                    const token = sessionStorage.getItem('mmToken')
                    if (token) await executeMint(token)
                  }}
                  className="flex-1 bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  ✨ Confirm &amp; Mint
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
