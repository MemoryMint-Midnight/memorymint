'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

// ─── responsive hook ────────────────────────────────────────────────────────
type Screen = 'mobile' | 'tablet' | 'desktop'
function useScreen(): Screen {
  const [screen, setScreen] = useState<Screen>('desktop')
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      setScreen(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return screen
}

// ─── Cardano logo ────────────────────────────────────────────────────────────
function CardanoLogo({ size = 44 }: { size?: number }) {
  return (
    <Image src="/Cardano Logo.png" alt="Cardano" width={size} height={size} style={{ objectFit: 'contain' }} />
  )
}

// ─── Clothespin ──────────────────────────────────────────────────────────────
function Clothespin() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: '50%',
      transform: 'translate(-50%, -55%)',
      zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ width: 4, height: 7, backgroundColor: '#78350f', borderRadius: 2 }} />
      <div style={{ width: 20, height: 7, backgroundColor: '#b45309', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', marginTop: -1 }} />
      <div style={{ display: 'flex', gap: 2, marginTop: 0 }}>
        <div style={{ width: 8, height: 13, backgroundColor: '#d97706', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 4px rgba(0,0,0,0.18)' }} />
        <div style={{ width: 8, height: 13, backgroundColor: '#d97706', borderRadius: '0 0 3px 3px', boxShadow: '0 2px 4px rgba(0,0,0,0.18)' }} />
      </div>
    </div>
  )
}

// ─── Polaroid ────────────────────────────────────────────────────────────────
interface PolaroidProps { src: string; rotate: number; ty?: number; size: number }

function Polaroid({ src, rotate, ty = 0, size }: PolaroidProps) {
  const pad = 7
  const bottom = Math.round(size * 0.22)
  const total = size + pad * 2
  return (
    <div style={{ position: 'relative', flexShrink: 0, transform: `rotate(${rotate}deg) translateY(${ty}px)` }}>
      <Clothespin />
      <div style={{
        backgroundColor: 'white',
        padding: `${pad}px`,
        paddingBottom: `${bottom}px`,
        boxShadow: '2px 4px 16px rgba(0,0,0,0.28)',
        width: `${total}px`,
        boxSizing: 'border-box',
      }}>
        <div style={{ width: `${size}px`, height: `${size}px`, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Memory" style={{ width: `${size}px`, height: `${size}px`, objectFit: 'cover', display: 'block' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Photo data ───────────────────────────────────────────────────────────────
type PhotoDef = { src: string; rotate: number; ty?: number }

const topPhotos: PhotoDef[] = [
  { src: '/sample-keepsake-01.png', rotate: -6, ty: 10 },
  { src: '/sample-keepsake-03.png', rotate:  3, ty: -5 },
  { src: '/sample-keepsake-04.png', rotate: -2, ty:  8 },
  { src: '/sample-keepsake-05.png', rotate:  5, ty: -8 },
]

const bottomPhotos: PhotoDef[] = [
  { src: '/sample-keepsake-06.png', rotate: -4, ty:  0  },
  { src: '/sample-keepsake-07.png', rotate:  6, ty: 14  },
  { src: '/sample-keepsake-08.jpg', rotate: -5, ty: -6  },
  { src: '/sample-keepsake-09.jpg', rotate:  3, ty: 10  },
]

// ─── Clothesline rope ─────────────────────────────────────────────────────────
function Rope() {
  return (
    <svg style={{ position: 'absolute', top: 34, left: 0, width: '100%', pointerEvents: 'none' }}
      height="22" preserveAspectRatio="none" viewBox="0 0 400 22">
      <path d="M0,8 Q100,18 200,12 Q300,6 400,14"
        stroke="#92400e" strokeWidth="1.5" fill="none" opacity="0.55" strokeLinecap="round" />
    </svg>
  )
}

// ─── Clothesline row ──────────────────────────────────────────────────────────
function ClotheslineRow({ photos, size }: { photos: PhotoDef[]; size: number }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 760, margin: '0 auto', padding: '0 12px' }}>
      <Rope />
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 42 }}>
        {photos.map((p, i) => (
          <Polaroid key={i} src={p.src} rotate={p.rotate} ty={p.ty} size={size} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const FREDOKA = "'Fredoka', sans-serif"
const GRAPE_NUTS = "'Grape Nuts', cursive"

// Site colours (match Header / Footer)
const MINT_YELLOW = '#ffefc2'
const MINT_CREAM  = '#ede4d8'

export default function ComingSoonPage() {
  const screen = useScreen()

  // Bypass: visit /coming-soon/?preview=mmpreview → sets a 24h cookie so Apache serves the full site
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('preview') === 'mmpreview') {
      document.cookie = 'mmbypass=1; max-age=86400; path=/'
      window.location.replace('/')
    }
  }, [])

  const photoSize  = screen === 'mobile' ? 80  : screen === 'tablet' ? 105 : 128
  const maxPhotos  = screen === 'mobile' ? 3   : 4
  const h1Size     = screen === 'mobile' ? 40  : screen === 'tablet' ? 52 : 60
  const logoW      = screen === 'mobile' ? 200 : 260
  const logoH      = Math.round(logoW * (75 / 260))

  const visibleTop    = topPhotos.slice(0, maxPhotos)
  const visibleBottom = bottomPhotos.slice(0, maxPhotos)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      overflowY: 'auto', backgroundColor: MINT_YELLOW,
      fontFamily: FREDOKA,
    }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* ── Logo ── */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28, paddingBottom: 4 }}>
          <Image src="/memory-mint-logo.png" alt="Memory Mint"
            width={logoW} height={logoH} style={{ objectFit: 'contain' }} priority />
        </div>

        {/* ── Top clothesline ── */}
        <ClotheslineRow photos={visibleTop} size={photoSize} />

        {/* ── Middle text ── */}
        <div style={{ textAlign: 'center', padding: '24px 20px 12px' }}>
          <h1 style={{
            fontFamily: GRAPE_NUTS,
            fontSize: h1Size, fontWeight: 700,
            background: 'linear-gradient(to right, #d97706, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 12px', lineHeight: 1.1,
          }}>
            Memory Mint
          </h1>
          <p style={{
            fontFamily: FREDOKA,
            fontSize: screen === 'mobile' ? 18 : 22,
            fontWeight: 400, color: '#374151',
            maxWidth: 560, margin: '0 auto', lineHeight: 1.6,
          }}>
            Preserve your precious moments as lasting digital keepsakes on the blockchain.
            Easy to use.
          </p>
          {/* Coming Soon badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <div style={{ height: 1, width: 52, backgroundColor: '#a16207', opacity: 0.4 }} />
            <span style={{
              fontFamily: FREDOKA, fontSize: screen === 'mobile' ? 16 : 20, fontWeight: 600,
              letterSpacing: '0.3em', textTransform: 'uppercase', color: '#a16207',
            }}>
              Coming Soon
            </span>
            <div style={{ height: 1, width: 52, backgroundColor: '#a16207', opacity: 0.4 }} />
          </div>
        </div>

        {/* ── Bottom clothesline ── */}
        <ClotheslineRow photos={visibleBottom} size={photoSize} />

        {/* ── Follow on X ── */}
        <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 8 }}>
          <a
            href="https://x.com/MemoryMint_Fun"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: FREDOKA,
              fontSize: screen === 'mobile' ? 15 : 17,
              fontWeight: 600,
              color: '#92400e',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '2px solid #d97706',
              paddingBottom: 2,
            }}
          >
            {/* X (Twitter) icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.631 5.903-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Go follow us on X
          </a>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 20 }} />

        {/* ── Bottom bar ── */}
        <div style={{ backgroundColor: MINT_CREAM, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{
            display: 'flex', flexWrap: 'nowrap',
            alignItems: 'center', justifyContent: 'center',
            gap: screen === 'mobile' ? 10 : 28,
            padding: screen === 'mobile' ? '16px 12px' : '18px 32px',
            width: '100%', boxSizing: 'border-box',
          }}>

            {/* Cardano text */}
            <div style={{ textAlign: 'center', flexShrink: 1 }}>
              <p style={{
                fontFamily: FREDOKA, fontSize: screen === 'mobile' ? 9 : 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#1c1917', lineHeight: 1.85, margin: 0,
                whiteSpace: 'nowrap',
              }}>
                Built on Cardano<br />
                for permanence and security
              </p>
            </div>

            {/* Logos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <CardanoLogo size={screen === 'mobile' ? 36 : 44} />
              <Image src="/midnight-logo.png" alt="Midnight" width={screen === 'mobile' ? 36 : 44} height={screen === 'mobile' ? 36 : 44} style={{ objectFit: 'contain' }} />
            </div>

            {/* Midnight text */}
            <div style={{ textAlign: 'center', flexShrink: 1 }}>
              <p style={{
                fontFamily: FREDOKA, fontSize: screen === 'mobile' ? 9 : 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#1c1917', lineHeight: 1.85, margin: 0,
                whiteSpace: 'nowrap',
              }}>
                Powered by Midnight<br />
                optional privacy protection
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
