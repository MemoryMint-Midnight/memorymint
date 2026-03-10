import { Suspense } from 'react'
import ShareContent from './ShareContent'

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-spin inline-block">⚙️</div>
            <p className="text-gray-500 text-lg">Loading memory…</p>
          </div>
        </div>
      }
    >
      <ShareContent />
    </Suspense>
  )
}
