'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import LoginModal from './LoginModal'

type LoginState = {
  type: 'wallet' | 'email' | null
  walletApi?: any
  email?: string
  address?: string
  balance?: string
}

export default function Header() {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginState, setLoginState] = useState<LoginState>({ type: null })
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // On page refresh: clear session so users must reconnect their wallet
    const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationType && navigationType.type === 'reload') {
      sessionStorage.removeItem('userEmail')
      sessionStorage.removeItem('walletConnected')
      sessionStorage.removeItem('mmToken')
      sessionStorage.removeItem('mmTokenExpiry')
      sessionStorage.removeItem('mmWalletAddress')
      sessionStorage.removeItem('mmWalletKey')
      setLoginState({ type: null })
      // Do NOT return — polling must still start so login from mint page works after refresh
    } else {
      // Not a refresh — restore any existing session
      const savedEmail = sessionStorage.getItem('userEmail')
      if (savedEmail) {
        setLoginState({ type: 'email', email: savedEmail })
      } else if (sessionStorage.getItem('walletConnected') === 'true') {
        setLoginState({ type: 'wallet', address: 'Wallet Connected', balance: '' })
      }

      // Auto-refresh: if the token is expiring within 24 hours, silently issue a new one
      const existingToken = sessionStorage.getItem('mmToken')
      const expiryStr = sessionStorage.getItem('mmTokenExpiry')
      if (existingToken && expiryStr) {
        const expiryMs = parseInt(expiryStr, 10)
        const oneDayMs = 24 * 60 * 60 * 1000
        if (Date.now() > expiryMs - oneDayMs) {
          const refreshBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
          fetch(`${refreshBase}/memorymint/v1/auth/refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${existingToken}` },
          })
            .then(r => r.json())
            .then(data => {
              if (data.success && data.token) {
                sessionStorage.setItem('mmToken', data.token)
                sessionStorage.setItem('mmTokenExpiry', String(data.expires_at * 1000))
              } else {
                // Token truly expired — force logout
                sessionStorage.removeItem('userEmail')
                sessionStorage.removeItem('walletConnected')
                sessionStorage.removeItem('mmToken')
                sessionStorage.removeItem('mmTokenExpiry')
                sessionStorage.removeItem('mmWalletAddress')
                sessionStorage.removeItem('mmWalletKey')
                setLoginState({ type: null })
              }
            })
            .catch(() => { /* network error — keep existing token, will surface on next API call */ })
        }
      }
    }

    // Poll sessionStorage every 500ms so login from any page component is reflected here
    const pollInterval = setInterval(() => {
      setLoginState((prev) => {
        const email = sessionStorage.getItem('userEmail')
        const wallet = sessionStorage.getItem('walletConnected') === 'true'

        if (wallet && prev.type !== 'wallet') {
          return { type: 'wallet', address: 'Wallet Connected', balance: '' }
        }
        if (email && prev.type !== 'email') {
          return { type: 'email', email }
        }
        if (!wallet && !email && prev.type !== null) {
          return { type: null }
        }
        return prev
      })
    }, 500)

    // Clear session on tab/window close
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('userEmail')
      sessionStorage.removeItem('walletConnected')
      sessionStorage.removeItem('mmToken')
      sessionStorage.removeItem('mmTokenExpiry')
      sessionStorage.removeItem('mmWalletAddress')
      sessionStorage.removeItem('mmWalletKey')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearInterval(pollInterval)
    }
  }, [])

  const handleLoginSuccess = (type: 'wallet' | 'email', data: any) => {
    if (type === 'wallet') {
      setLoginState({
        type: 'wallet',
        walletApi: data.walletApi,
        address: data.address,
        balance: data.balance,
      })
      sessionStorage.setItem('walletConnected', 'true')
      // Note: wallet sessions are temporary and cleared on page close
    } else if (type === 'email') {
      setLoginState({ type: 'email', email: data.email })
      sessionStorage.setItem('userEmail', data.email)
    }
    // Don't auto-redirect - stay on current page
  }

  const handleDisconnect = async () => {
    // Invalidate the server-side token (fire-and-forget — logout always succeeds client-side)
    const token = sessionStorage.getItem('mmToken')
    if (token) {
      const apiBase = (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '').replace('/wp/v2', '')
      fetch(`${apiBase}/memorymint/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    setLoginState({ type: null })
    sessionStorage.removeItem('userEmail')
    sessionStorage.removeItem('walletConnected')
    sessionStorage.removeItem('mmToken')
    sessionStorage.removeItem('mmTokenExpiry')
    sessionStorage.removeItem('mmWalletAddress')
    sessionStorage.removeItem('mmWalletKey')
    router.push('/')
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-mint-yellow border-b border-gray-200 sticky top-0 z-50 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/memory-mint-logo.png"
                alt="Memory Mint"
                width={150}
                height={42}
                className="h-10 w-auto"
                priority
              />
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
              <Link
                href="/"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
              >
                Home
              </Link>
              <Link
                href="/memories"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
              >
                Memories
              </Link>
              <Link
                href="/guide"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
              >
                Guide
              </Link>
              <Link
                href="/faq"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
              >
                FAQ
              </Link>
              <Link
                href="/midnight"
                className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
              >
                Privacy
              </Link>
              {(loginState.type === 'wallet' || loginState.type === 'email') && (
                <Link
                  href="/gallery"
                  className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Gallery
                </Link>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden flex items-center justify-center w-10 h-10 text-gray-700 hover:text-amber-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {showMobileMenu ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            {/* Login / User State - Desktop */}
            <div className="hidden md:flex">
            {loginState.type === 'wallet' ? (
              // Wallet Connected State
              <div className="flex items-center gap-3">
                <Link href="/account" className="hidden md:flex items-center gap-2 bg-white/50 hover:bg-white/80 rounded-xl px-4 py-2 transition-colors">
                  {loginState.balance ? (
                    <>
                      <span className="text-sm font-medium text-gray-700">{loginState.balance} ₳</span>
                      <span className="text-xs text-gray-500">{loginState.address}</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-gray-700">{loginState.address}</span>
                  )}
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDisconnect}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Disconnect
                </motion.button>
              </div>
            ) : loginState.type === 'email' ? (
              // Email Logged In State
              <div className="flex items-center gap-3">
                <Link href="/account" className="hidden md:flex items-center gap-2 bg-white/50 hover:bg-white/80 rounded-xl px-4 py-2 transition-colors">
                  <span className="text-sm font-medium text-gray-700">{loginState.email}</span>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDisconnect}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Logout
                </motion.button>
              </div>
            ) : (
              // Not Logged In - Show Login Button
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLoginModal(true)}
                className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-5 py-2 rounded-xl transition-colors shadow-md"
              >
                Login
              </motion.button>
            )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 bg-mint-yellow"
            >
              <div className="px-4 py-4 space-y-3">
                <Link
                  href="/"
                  onClick={() => setShowMobileMenu(false)}
                  className="block text-gray-700 hover:text-amber-600 py-2 font-medium"
                >
                  Home
                </Link>
                <Link
                  href="/memories"
                  onClick={() => setShowMobileMenu(false)}
                  className="block text-gray-700 hover:text-amber-600 py-2 font-medium"
                >
                  Memories
                </Link>
                <Link
                  href="/guide"
                  onClick={() => setShowMobileMenu(false)}
                  className="block text-gray-700 hover:text-amber-600 py-2 font-medium"
                >
                  Guide
                </Link>
                <Link
                  href="/faq"
                  onClick={() => setShowMobileMenu(false)}
                  className="block text-gray-700 hover:text-amber-600 py-2 font-medium"
                >
                  FAQ
                </Link>
                <Link
                  href="/midnight"
                  onClick={() => setShowMobileMenu(false)}
                  className="block text-gray-700 hover:text-amber-600 py-2 font-medium"
                >
                  Privacy
                </Link>
                {(loginState.type === 'wallet' || loginState.type === 'email') && (
                  <>
                    <Link
                      href="/gallery"
                      onClick={() => setShowMobileMenu(false)}
                      className="block bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-4 py-2 rounded-xl transition-colors text-center"
                    >
                      Gallery
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setShowMobileMenu(false)}
                      className="block bg-white hover:bg-gray-50 text-gray-700 font-semibold px-4 py-2 rounded-xl border-2 border-gray-200 transition-colors text-center"
                    >
                      My Account
                    </Link>
                  </>
                )}

                {/* Mobile Login State */}
                <div className="pt-3 border-t border-gray-200">
                  {loginState.type === 'wallet' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-white/50 rounded-xl px-4 py-2">
                        {loginState.balance ? (
                          <>
                            <span className="text-sm font-medium text-gray-700">{loginState.balance} ₳</span>
                            <span className="text-xs text-gray-500">{loginState.address}</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-gray-700">{loginState.address}</span>
                        )}
                      </div>
                      <button
                        onClick={handleDisconnect}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : loginState.type === 'email' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-white/50 rounded-xl px-4 py-2">
                        <span className="text-sm font-medium text-gray-700">{loginState.email}</span>
                      </div>
                      <button
                        onClick={handleDisconnect}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowLoginModal(true)
                        setShowMobileMenu(false)
                      }}
                      className="w-full bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-5 py-2 rounded-xl transition-colors shadow-md"
                    >
                      Login
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(type, data) => {
          handleLoginSuccess(type, data)
          setShowLoginModal(false)
        }}
      />
    </>
  )
}
