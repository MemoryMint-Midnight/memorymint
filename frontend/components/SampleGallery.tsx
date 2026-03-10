'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface SampleMemory {
  id: string
  title: string
  description: string
  image: string
  date: string
  privacy: 'public' | 'shared' | 'private'
}

const sampleMemories: SampleMemory[] = [
  {
    id: '1',
    title: 'My Wedding Day!',
    description: 'The day that will always be in my memories as a special day!',
    image: '/sample-keepsake-01.png',
    date: 'December 2017',
    privacy: 'public',
  },
  {
    id: '3',
    title: 'First Couples Photoshoot',
    description: 'Botanical Garden',
    image: '/sample-keepsake-03.png',
    date: 'June 2017',
    privacy: 'public',
  },
  {
    id: '4',
    title: 'Wedding Rings',
    description: 'Our wedding Rings all on display!',
    image: '/sample-keepsake-04.png',
    date: 'December 2017',
    privacy: 'private',
  },
  {
    id: '5',
    title: 'Loving Cat Life',
    description: 'The live of foster Cats',
    image: '/sample-keepsake-05.png',
    date: 'July 2022',
    privacy: 'shared',
  },
  {
    id: '6',
    title: 'My First Born Son',
    description: 'Fatherly love will be forever',
    image: '/sample-keepsake-06.png',
    date: 'November 2020',
    privacy: 'public',
  },
  {
    id: '7',
    title: 'So Small, So Prescious',
    description: 'That feeling nobody can explain.',
    image: '/sample-keepsake-07.png',
    date: 'November 2020',
    privacy: 'public',
  },
]

export default function SampleGallery() {
  const [selectedMemory, setSelectedMemory] = useState<SampleMemory | null>(null)

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

  // Tape rotation angles for variety
  const tapeAngles = [-8, 3, 12, -5, 6, -10]
  const tapePositions = ['right-6', 'left-1/2 -translate-x-1/2', 'left-8', 'right-10', 'left-6', 'right-8']
  const cardRotations = [1.5, -1.2, 2, -0.8, 1.8, -1.5]

  return (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
        {sampleMemories.map((memory, index) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, y: 20, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: cardRotations[index] || 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ rotate: 0, y: -8, scale: 1.02 }}
            onClick={() => setSelectedMemory(memory)}
            className="cursor-pointer mx-auto w-full max-w-sm"
          >
            <div className="relative">
              {/* Tape piece */}
              <div
                className={`absolute -top-2 ${tapePositions[index]} w-12 h-5 z-10 rounded-sm shadow-sm`}
                style={{
                  transform: `rotate(${tapeAngles[index]}deg)`,
                  background: 'linear-gradient(135deg, rgba(245,222,179,0.75) 0%, rgba(222,198,156,0.5) 100%)',
                }}
              />
              <div className="bg-white pt-3 px-3 pb-10 rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300">
                {/* Photo Area */}
                <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                  <Image
                    src={memory.image}
                    alt={memory.title}
                    fill
                    className={`object-cover ${memory.privacy === 'private' ? 'blur-lg' : ''}`}
                  />
                  {memory.privacy === 'private' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="bg-white/90 px-4 py-2 rounded-xl">
                        <p className="text-sm font-medium text-gray-800">🔐 Private - Blurred</p>
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
                  <p className="text-xs text-gray-500">{memory.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{memory.date}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Memory Detail Modal */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMemory(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2px] shadow-[0_4px_20px_rgb(0,0,0,0.15),0_1px_3px_rgb(0,0,0,0.1)] max-w-2xl w-full overflow-hidden"
            >
              <div className="relative pt-4 px-4">
                <div className="bg-gray-900 overflow-hidden relative" style={{ aspectRatio: '400/256' }}>
                  <Image
                    src={selectedMemory.image}
                    alt={selectedMemory.title}
                    fill
                    className={`object-cover ${selectedMemory.privacy === 'private' ? 'blur-lg' : ''}`}
                  />
                  {selectedMemory.privacy === 'private' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-white/95 px-6 py-4 rounded-2xl text-center">
                        <p className="text-lg font-bold text-gray-800 mb-1">🔐 Private Memory</p>
                        <p className="text-sm text-gray-600">This content is blurred for privacy</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-lg"
                >
                  ×
                </button>
              </div>

              <div className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-3xl font-bold text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>{selectedMemory.title}</h2>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${privacyColors[selectedMemory.privacy]}`}>
                    {privacyIcons[selectedMemory.privacy]} {selectedMemory.privacy.charAt(0).toUpperCase() + selectedMemory.privacy.slice(1)}
                  </div>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">{selectedMemory.description}</p>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="font-medium text-gray-800">{selectedMemory.date}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Privacy:</span>
                      <p className="font-medium text-gray-800 capitalize">{selectedMemory.privacy}</p>
                    </div>
                  </div>
                </div>

                {/* Sample Notice */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-800 font-medium">
                    💡 This is a sample keepsake for demonstration purposes
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Real keepsakes will include blockchain verification links
                  </p>
                </div>

                {/* Actions - No blockchain link for samples */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gray-300 text-gray-500 font-semibold px-6 py-3 rounded-xl cursor-not-allowed"
                    disabled
                  >
                    🔗 Copy Link (Sample)
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-gray-300 text-gray-500 font-semibold px-6 py-3 rounded-xl cursor-not-allowed"
                    disabled
                  >
                    🔍 View Proof (Sample)
                  </motion.button>
                </div>

                {/* Midnight Toggle for private samples */}
                {selectedMemory.privacy === 'private' && (
                  <div className="mt-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">🌙 Midnight Privacy Active</p>
                        <p className="text-sm text-gray-600">Sensitive details are protected</p>
                      </div>
                      <span className="text-xs text-purple-600 font-medium">(Sample)</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
