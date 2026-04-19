import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-mint-yellow border-t border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Memory Mint</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Preserve your precious moments as lasting digital keepsakes on the blockchain.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Legal</h3>
            <div className="space-y-2 text-gray-600">
              <Link href="/terms" className="block hover:text-amber-600 transition-colors text-sm">
                Terms of Service
                <p className="text-xs opacity-75">How Memory Mint works</p>
              </Link>
              <Link href="/privacy" className="block hover:text-amber-600 transition-colors text-sm">
                Privacy Policy
                <p className="text-xs opacity-75">Your data protection</p>
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Contact</h3>
            <div className="space-y-2 text-gray-600 text-sm">
              <a
                href="mailto:support@memorymint.io"
                className="block hover:text-amber-600 transition-colors"
              >
                support@memorymint.io
              </a>
              <a
                href="https://x.com/MemoryMint_Fun"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-amber-600 transition-colors"
              >
                X (Twitter): @MemoryMint_Fun
              </a>
              <div className="pt-1">
                <p className="text-xs opacity-75 mb-1">Founder</p>
                <a
                  href="https://x.com/_Just_Jinx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:text-amber-600 transition-colors"
                >
                  X (Twitter): @_Just_Jinx
                </a>
              </div>
            </div>
          </div>

          {/* Technology */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Technology</h3>
            <div className="space-y-2 text-gray-600 text-sm">
              <div>
                <p className="font-medium text-gray-700">Built on Cardano</p>
                <p className="text-xs opacity-75">For permanence and security</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Powered by Midnight</p>
                <p className="text-xs opacity-75">Rational privacy protection</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200/50 pt-6 text-center">
          <div className="text-sm text-gray-600">
            © 2026 Memory Mint — All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
