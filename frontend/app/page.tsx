'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Mint a moment. Keep it forever.
        </h1>
        <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
          Preserve photos, notes, and milestones as lasting digital keepsakes — without technical jargon, confusing wallets, or complicated steps.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/mint">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
            >
              Create a Memory
            </motion.button>
          </Link>
          <Link href="/guide">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg border-2 border-gray-200 transition-all"
            >
              See how it works
            </motion.button>
          </Link>
        </div>

        {/* Trust Pills */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center text-sm text-gray-600 mb-12">
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span>Takes a few minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span>You control who sees it</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span>Cardano + optional Midnight privacy</span>
          </div>
        </div>
      </motion.div>

      {/* Hero Polaroid Keepsake Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: -1.5 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="max-w-2xl mx-auto mb-20"
      >
        <div className="relative">
          {/* Tape piece */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-amber-100/80 rounded-sm rotate-2 z-10 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(245,222,179,0.7) 0%, rgba(222,198,156,0.5) 100%)' }} />
          <div className="bg-white pt-4 px-4 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
            {/* Photo Area */}
            <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
              <Image
                src="/hero-keepsake.png"
                alt="Digital Keepsake - Hands holding vintage photos"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
            {/* Polaroid Caption Area - thicker bottom */}
            <div className="text-center pt-4 pb-1">
              <h2 className="text-2xl font-bold mb-2 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>A digital keepsake</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Upload a photo, add a personal note, choose who can see it, and preserve it forever.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Polaroid Keepsake Cards */}
      <div className="grid md:grid-cols-3 gap-12 mb-20 px-4">
        {/* Card 1: Family Moments */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: 2.5 }}
          transition={{ delay: 0.4 }}
          whileHover={{ rotate: 0, y: -8, scale: 1.02 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="relative">
            {/* Tape piece - top right */}
            <div className="absolute -top-2 right-6 w-12 h-5 z-10 -rotate-12 rounded-sm shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(245,222,179,0.75) 0%, rgba(222,198,156,0.5) 100%)' }} />
            <div className="bg-white pt-3 px-3 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
              {/* Photo Area */}
              <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                <Image
                  src="/family-moments.png"
                  alt="Family Moments - Multi-generational family together"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              {/* Polaroid Caption */}
              <div className="text-center pt-4 pb-1">
                <h3 className="text-lg font-bold mb-1 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Easy for anyone</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Gentle, guided steps designed for families, not tech experts.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Your Control */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: -1.8 }}
          transition={{ delay: 0.5 }}
          whileHover={{ rotate: 0, y: -8, scale: 1.02 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="relative">
            {/* Tape piece - top center */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 z-10 rotate-3 rounded-sm shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(245,222,179,0.75) 0%, rgba(222,198,156,0.5) 100%)' }} />
            <div className="bg-white pt-3 px-3 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
              {/* Photo Area */}
              <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                <Image
                  src="/your-control.png"
                  alt="Your Control - Privacy and choice concept"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              {/* Polaroid Caption */}
              <div className="text-center pt-4 pb-1">
                <h3 className="text-lg font-bold mb-1 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>You're in control</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Decide whether your memory is private, shared with loved ones, or public.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Built to Last */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: 2 }}
          transition={{ delay: 0.6 }}
          whileHover={{ rotate: 0, y: -8, scale: 1.02 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="relative">
            {/* Tape piece - top left */}
            <div className="absolute -top-2 left-8 w-12 h-5 z-10 rotate-6 rounded-sm shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(245,222,179,0.75) 0%, rgba(222,198,156,0.5) 100%)' }} />
            <div className="bg-white pt-3 px-3 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
              {/* Photo Area */}
              <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                <Image
                  src="/built-to-last.png"
                  alt="Built to Last - Vintage photo album and memories"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
              {/* Polaroid Caption */}
              <div className="text-center pt-4 pb-1">
                <h3 className="text-lg font-bold mb-1 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Built to last</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Stored on Cardano, designed for long-term preservation — not temporary storage.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Save What Matters Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-3xl p-12 mb-20 shadow-xl text-center"
      >
        <h2 className="text-4xl font-bold mb-6 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Save what matters</h2>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
          Family photos, love notes, letters to the future, and moments you never want to lose.
        </p>
        <Link href="/mint">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
          >
            Preserve a Memory
          </motion.button>
        </Link>
      </motion.div>

      {/* Privacy Callout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-12 text-white text-center shadow-xl"
      >
        <div className="flex justify-center mb-6">
          <Image
            src="/midnight-logo.png"
            alt="Midnight Privacy"
            width={64}
            height={64}
            className="brightness-0 invert"
          />
        </div>
        <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: "'Grape Nuts', cursive" }}>Privacy when you want it</h2>
        <p className="text-xl mb-8 max-w-3xl mx-auto leading-relaxed opacity-90">
          Some memories are personal. Optional Midnight privacy protects sensitive details while still preserving proof on-chain.
        </p>
        <Link href="/midnight">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-indigo-600 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
          >
            Read about Privacy
          </motion.button>
        </Link>
      </motion.div>
    </div>
  )
}
