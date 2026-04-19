'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SeedPhraseModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

type Step = 'warning' | 'reveal' | 'verify' | 'done'

export default function SeedPhraseModal({ isOpen, onClose, onComplete }: SeedPhraseModalProps) {
  const [step, setStep] = useState<Step>('warning')
  const [words, setWords] = useState<string[]>([])
  const [walletAddress, setWalletAddress] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [verifyIndices, setVerifyIndices] = useState<[number, number]>([0, 1])
  const [verifyInputs, setVerifyInputs] = useState<[string, string]>(['', ''])
  const [verifyError, setVerifyError] = useState('')

  const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')

  function handleClose() {
    // Block closing mid-flow — user must complete or be on warning/done step
    if (step === 'reveal' || step === 'verify') return
    if (step === 'done') onComplete()
    else onClose()
    setTimeout(() => {
      setStep('warning')
      setWords([])
      setWalletAddress('')
      setRevealed(false)
      setConfirmed(false)
      setCopied(false)
      setError('')
      setVerifyInputs(['', ''])
      setVerifyError('')
    }, 300)
  }

  async function handleShowPhrase() {
    setIsLoading(true)
    setError('')
    try {
      const token = sessionStorage.getItem('mmToken')
      const res = await fetch(`${apiBase}/memorymint/v1/auth/seed-phrase`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to load seed phrase.')
        return
      }
      const w = data.mnemonic.trim().split(/\s+/)
      setWords(w)
      setWalletAddress(data.wallet_address || '')
      // Pick 2 distinct random positions for the verify step
      const a = Math.floor(Math.random() * w.length)
      let b = Math.floor(Math.random() * (w.length - 1))
      if (b >= a) b++
      setVerifyIndices([a, b])
      setVerifyInputs(['', ''])
      setVerifyError('')
      setStep('reveal')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleAdvanceToVerify() {
    setVerifyError('')
    setStep('verify')
  }

  async function handleVerifyAndConfirm() {
    const [i, j] = verifyIndices
    const [a, b] = verifyInputs
    if (a.trim().toLowerCase() !== words[i].toLowerCase() || b.trim().toLowerCase() !== words[j].toLowerCase()) {
      setVerifyError('One or more words are incorrect. Check your written copy and try again.')
      return
    }
    setIsLoading(true)
    setVerifyError('')
    try {
      const token = sessionStorage.getItem('mmToken')
      const res = await fetch(`${apiBase}/memorymint/v1/auth/confirm-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) {
        setVerifyError('Failed to confirm backup. Please try again.')
        return
      }
      setStep('done')
    } catch {
      setVerifyError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCopyAll() {
    navigator.clipboard?.writeText(words.join(' '))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden"
          >
            {/* Close button — hidden mid-flow to prevent accidental dismissal */}
            {step !== 'reveal' && step !== 'verify' && (
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-2xl leading-none z-10"
                aria-label="Close"
              >
                ×
              </button>
            )}

            <AnimatePresence mode="wait">
              {/* ─── Step 1: Warning ─── */}
              {step === 'warning' && (
                <motion.div
                  key="warning"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8"
                >
                  <div className="text-4xl mb-4">🔐</div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-3 font-schoolbell">
                    Your Wallet Backup
                  </h2>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    Your 24-word seed phrase is the master key to your wallet. Anyone who has
                    it can access your NFTs and funds.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 space-y-2 text-sm text-amber-800">
                    <p className="font-semibold">Before you continue:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Write the words down on paper — do not screenshot</li>
                      <li>Store it somewhere safe and private</li>
                      <li>Never share it with anyone, including us</li>
                      <li>Once you confirm backup, we delete it from our servers</li>
                    </ul>
                  </div>

                  {error && (
                    <p className="text-red-500 text-sm mb-4">{error}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleShowPhrase}
                    disabled={isLoading}
                    className="w-full bg-mint-gold hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all"
                  >
                    {isLoading ? 'Loading…' : 'Show My Seed Phrase'}
                  </button>
                </motion.div>
              )}

              {/* ─── Step 2: Reveal ─── */}
              {step === 'reveal' && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8"
                >
                  <h2 className="text-3xl font-bold text-gray-800 mb-1 font-schoolbell">
                    Your Seed Phrase
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    {revealed ? 'Write these words down in order.' : 'Click the grid to reveal your words.'}
                  </p>

                  {/* Word grid */}
                  <div
                    className="relative bg-mint-cream rounded-2xl p-4 mb-4 cursor-pointer select-none"
                    onClick={() => setRevealed(true)}
                  >
                    {!revealed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-mint-cream/80 z-10">
                        <span className="text-3xl mb-1">👁</span>
                        <span className="text-sm font-semibold text-gray-700">Click to reveal</span>
                      </div>
                    )}
                    <div
                      className="grid grid-cols-4 gap-2 transition-all duration-300"
                      style={{ filter: revealed ? 'none' : 'blur(8px)' }}
                    >
                      {words.map((word, i) => (
                        <div key={i} className="bg-white rounded-xl px-2 py-1.5 text-center shadow-sm">
                          <span className="block text-[10px] text-gray-400 leading-none mb-0.5">{i + 1}</span>
                          <span className="text-xs font-mono font-semibold text-gray-800">{word}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="w-full mb-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-2xl transition-all text-sm"
                  >
                    {copied ? '✓ Copied to clipboard' : '📋 Copy All Words'}
                  </button>

                  {/* Wallet address */}
                  {walletAddress && (
                    <p className="text-[11px] text-gray-400 font-mono break-all text-center mb-4">
                      {walletAddress}
                    </p>
                  )}

                  {/* Confirmation checkbox — only enabled after words are revealed */}
                  <label className={`flex items-start gap-3 mb-5 group ${revealed ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => revealed && setConfirmed(e.target.checked)}
                      disabled={!revealed}
                      className="mt-1 w-4 h-4 accent-[#ffbd59] cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                      I have written down all 24 words in order and stored them somewhere safe
                    </span>
                  </label>

                  {error && (
                    <p className="text-red-500 text-sm mb-3">{error}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleAdvanceToVerify}
                    disabled={!confirmed || !revealed}
                    className="w-full bg-mint-gold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all"
                  >
                    Verify Backup →
                  </button>
                </motion.div>
              )}

              {/* ─── Step 3: Verify ─── */}
              {step === 'verify' && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8"
                >
                  <div className="text-4xl mb-4">✍️</div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2 font-schoolbell">
                    Verify Your Backup
                  </h2>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    Enter the two words below from your written copy to confirm you saved it correctly.
                  </p>

                  <div className="space-y-4 mb-6">
                    {([0, 1] as const).map((slot) => (
                      <div key={slot}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Word #{verifyIndices[slot] + 1}
                        </label>
                        <input
                          type="text"
                          value={verifyInputs[slot]}
                          onChange={(e) => {
                            const updated: [string, string] = [...verifyInputs] as [string, string]
                            updated[slot] = e.target.value
                            setVerifyInputs(updated)
                            setVerifyError('')
                          }}
                          placeholder={`Enter word #${verifyIndices[slot] + 1}`}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>
                    ))}
                  </div>

                  {verifyError && (
                    <p className="text-red-500 text-sm mb-4">{verifyError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleVerifyAndConfirm}
                    disabled={!verifyInputs[0].trim() || !verifyInputs[1].trim() || isLoading}
                    className="w-full bg-mint-gold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-all"
                  >
                    {isLoading ? 'Confirming…' : 'Complete Backup'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setVerifyError(''); setStep('reveal') }}
                    disabled={isLoading}
                    className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    ← Back to seed phrase
                  </button>
                </motion.div>
              )}

              {/* ─── Step 4: Done ─── */}
              {step === 'done' && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 text-center"
                >
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-3 font-schoolbell">
                    Backup Complete
                  </h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Your seed phrase has been removed from our servers. You are now in full
                    control of your wallet — keep that seed phrase safe!
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full bg-mint-gold hover:opacity-90 text-white font-semibold py-3 rounded-2xl transition-all"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
