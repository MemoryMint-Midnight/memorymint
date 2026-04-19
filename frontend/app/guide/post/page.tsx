'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPostBySlug, getFeaturedImageUrl, WPPost } from '@/lib/wordpress'
import Link from 'next/link'
import Image from 'next/image'

function GuidePostInner() {
  const params = useSearchParams()
  const slug = params.get('slug') || ''

  const [post, setPost] = useState<WPPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    getPostBySlug(slug)
      .then(p => { if (!p) setNotFound(true); else setPost(p) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
      <p className="text-gray-500">Loading…</p>
    </div>
  )

  if (notFound || !post) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <p className="text-gray-500 mb-6">Post not found.</p>
      <Link href="/guide">
        <button type="button" className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-2xl transition-all shadow-md">
          ← Back to Guide
        </button>
      </Link>
    </div>
  )

  const featuredImage = getFeaturedImageUrl(post)
  const publishedDate = new Date(post.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Link href="/guide" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium mb-10">
        ← Back to Guide
      </Link>

      {featuredImage && (
        <div className="relative w-full h-64 rounded-2xl overflow-hidden mb-8 shadow-lg">
          <Image src={featuredImage} alt={post.title.rendered} fill className="object-cover" />
        </div>
      )}

      <h1
        className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 font-schoolbell"
        dangerouslySetInnerHTML={{ __html: post.title.rendered }}
      />

      <p className="text-sm text-gray-500 mb-10">{publishedDate}</p>

      <article
        className="prose prose-lg prose-amber max-w-none text-gray-700 leading-relaxed
          prose-headings:font-semibold prose-headings:text-gray-800
          prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-xl prose-img:shadow-md"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />

      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <Link href="/guide">
          <button type="button" className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-3 rounded-2xl transition-all shadow-md">
            ← More Guides
          </button>
        </Link>
      </div>
    </div>
  )
}

export default function GuidePostPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
        <p className="text-gray-500">Loading…</p>
      </div>
    }>
      <GuidePostInner />
    </Suspense>
  )
}
