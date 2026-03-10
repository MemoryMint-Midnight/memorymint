'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function MidnightPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <div className="flex justify-center mb-6">
          <Image
            src="/midnight-logo.png"
            alt="Midnight"
            width={200}
            height={200}
            className="h-32 w-auto"
          />
        </div>
        <h1 className="text-5xl font-bold mb-2 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Midnight Privacy
        </h1>
        <p className="text-lg text-amber-600 font-semibold mb-4">(Coming Soon)</p>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
          Preserve memories permanently without making personal details public.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/mint">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
            >
              Create a Private Memory
            </motion.button>
          </Link>
          <Link href="/guide">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg border-2 border-gray-200 transition-all"
            >
              Back to Guide
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Privacy Modes Explained */}
      <div className="mb-20">
        <h2 className="text-3xl font-semibold text-center mb-12 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Privacy modes explained
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Public */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-8 shadow-lg"
          >
            <div className="text-5xl mb-6">🌍</div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Public</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Visible to anyone with the link.
            </p>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>✓ Shareable with everyone</li>
              <li>✓ Permanent blockchain record</li>
              <li>✓ Fully transparent</li>
            </ul>
          </motion.div>

          {/* Shared */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl p-8 shadow-lg"
          >
            <div className="text-5xl mb-6">👥</div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Shared</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Visible only to people you choose.
            </p>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>✓ Invite-only access</li>
              <li>✓ Control who sees it</li>
              <li>✓ Perfect for family sharing</li>
            </ul>
          </motion.div>

          {/* Private (Midnight) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-8 shadow-lg border-2 border-purple-300"
          >
            <div className="text-5xl mb-6">🔐</div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Private (Midnight)</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Details are protected while ownership and existence remain verifiable.
            </p>
            <ul className="text-gray-600 space-y-2 text-sm">
              <li>✓ Zero-knowledge privacy</li>
              <li>✓ Encrypted content</li>
              <li>✓ You control access entirely</li>
            </ul>
          </motion.div>
        </div>
      </div>

      {/* What is Midnight Section */}
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-3xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            What is Midnight?
          </h2>
          <p className="text-gray-600 mb-4 leading-relaxed">
            Midnight is a privacy-focused blockchain built on Cardano that allows you to keep your data completely private while still being verifiable on the blockchain.
          </p>
          <p className="text-gray-600 leading-relaxed">
            With Midnight, you can choose which memories are public and which remain private, giving you full control over your digital legacy.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-3xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Why Privacy Matters
          </h2>
          <p className="text-gray-600 mb-4 leading-relaxed">
            Some memories are deeply personal. Medical records, family secrets, private moments - these deserve protection while still being permanently preserved.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Midnight ensures only you (or those you authorize) can access these memories, while proving they exist on the blockchain.
          </p>
        </motion.div>
      </div>

      {/* Features Coming Soon */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-12 text-white text-center mb-16"
      >
        <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: "'Grape Nuts', cursive" }}>Features Coming Soon</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>Zero-Knowledge Proofs</h3>
            <p className="text-indigo-100">
              Prove your memories exist without revealing their contents
            </p>
          </div>
          <div>
            <div className="text-4xl mb-3">🔑</div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>Selective Disclosure</h3>
            <p className="text-indigo-100">
              Share specific memories with specific people
            </p>
          </div>
          <div>
            <div className="text-4xl mb-3">⏰</div>
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'Grape Nuts', cursive" }}>Time-Locked Reveals</h3>
            <p className="text-indigo-100">
              Set memories to be revealed at a future date
            </p>
          </div>
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center bg-white rounded-2xl p-12 shadow-lg"
      >
        <h2 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Interested in Midnight Privacy?
        </h2>
        <p className="text-gray-600 mb-6 text-lg">
          Follow Midnight on X to stay up to date with their latest news and launch updates
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://x.com/MidnightNtwrk"
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 bg-black hover:bg-gray-900 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Follow @MidnightNtwrk
            </motion.button>
          </a>
          <a
            href="https://midnight.network/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-8 py-4 rounded-2xl transition-all"
            >
              Midnight Network
            </motion.button>
          </a>
        </div>
      </motion.div>
    </div>
  )
}
