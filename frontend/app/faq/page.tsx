'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import ContactSupportModal from '@/components/ContactSupportModal'

const faqs = [
  {
    question: 'Do I need to understand blockchain?',
    answer:
      'No. Memory Mint handles the technical side for you. You just upload a photo, add a message, and we take care of preserving it securely on the Cardano blockchain.',
  },
  {
    question: 'Is this an NFT?',
    answer:
      'It\'s a digital keepsake you own — designed to feel personal, not speculative. While it uses NFT technology, Memory Mint focuses on preservation and meaning, not trading or speculation.',
  },
  {
    question: 'What is Midnight privacy?',
    answer:
      'An optional privacy layer that protects sensitive details from public view. With Midnight, your memory remains yours while still being verifiable on the blockchain.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'Each keepsake mint is $2.50 USD (or the equivalent in ADA / other supported crypto at the time of minting). If you mint a full batch of 5 keepsakes at once, you pay a flat $10.00 USD — giving you a saving compared to minting them individually. This batch discount only applies when you mint all 5 together; there is no reduced price for 2, 3, or 4 keepsakes. Crypto equivalent amounts are calculated at current exchange rates at the time you mint. Please note that a small blockchain transaction fee (usually 1–2 ADA) is charged by the Cardano network on top of the keepsake fee to process and record your mint on-chain. This fee goes directly to the network, not to Memory Mint.',
  },
  {
    question: 'Can I share my memories with family?',
    answer:
      'Absolutely! You can choose to make memories public, share them with specific people, or keep them completely private. You\'re always in control. With Midnight, if you wanted to share private Keepsakes you have the option to share your View Keys with them. Keep in mind once this has been shared it can\'t be revoked, so only share with important people in your life.',
  },
  {
    question: 'What happens to my memories?',
    answer:
      'Your memories are permanently stored on the Cardano blockchain. Once minted, they cannot be deleted or altered — ensuring they\'re preserved exactly as you created them, forever.',
  },
  {
    question: 'Why mint on Cardano and have Midnight?',
    answer:
      'Think of Cardano as a very secure, permanent digital filing cabinet that no single person or company controls — not even us. Once your memory is stored there, it can\'t be tampered with, taken down, or lost if Memory Mint ever closes. It\'s also one of the most energy-efficient and low-cost blockchains available, meaning your keepsakes are affordable to create and kind to the environment. Midnight is our privacy layer for memories you want to protect. Without it, your keepsake is stored openly on the blockchain — anyone who looks can see it. With Midnight, the details of your memory are shielded so only you (and anyone you choose to share with) can view them, while the blockchain still proves it\'s genuinely yours. Together, Cardano and Midnight mean your memories are permanent, affordable, and as private as you want them to be.',
  },
  {
    question: 'Do I need a crypto wallet?',
    answer:
      'For blockchain ownership, yes — but we also offer simple email login for those who prefer it. You can always upgrade to full blockchain ownership later. If you\'d like to connect a Cardano wallet, we recommend any of the following: Nami, Vespr, Begin, Eternl, or Lace — these are all fully supported and easy to set up as browser extensions. We also support Typhon, GeroWallet, NuFi, and Yoroi. Any CIP-30 compatible Cardano wallet will work seamlessly with Memory Mint.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. Your memories are stored on the secure Cardano blockchain. With optional Midnight privacy, sensitive details remain encrypted and only accessible to you.',
  },
]

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Questions, answered
        </h1>
        <p className="text-xl text-gray-600">
          Clear answers for families and first-time users.
        </p>
      </motion.div>

      <div className="space-y-4 mb-12">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-xl font-semibold text-gray-800 pr-4" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                {faq.question}
              </h3>
              <motion.span
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="text-2xl text-amber-600 flex-shrink-0"
              >
                ↓
              </motion.span>
            </button>

            <motion.div
              initial={false}
              animate={{
                height: openIndex === index ? 'auto' : 0,
                opacity: openIndex === index ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-8 pb-6 text-gray-600 leading-relaxed">{faq.answer}</div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 text-center bg-mint-yellow rounded-2xl p-8"
      >
        <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Still have questions?
        </h2>
        <p className="text-gray-600 mb-6">
          Reach out to our team and we'll be happy to help!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowContactModal(true)}
            className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Contact Support
          </motion.button>
          <Link href="/guide">
            <button className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-8 py-3 rounded-xl border-2 border-gray-200 transition-colors">
              Read the Guide
            </button>
          </Link>
        </div>
      </motion.div>

      {/* Contact Support Modal */}
      <ContactSupportModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </div>
  )
}
