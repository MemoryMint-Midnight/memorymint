import { getPosts } from '@/lib/wordpress'
import Link from 'next/link'

export default async function GuidePage() {
  const posts = await getPosts({ perPage: 10, orderBy: 'date' })

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Intro */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>How it works</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
          Preserving a memory should feel simple, not technical.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/mint">
            <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all">
              Create a Memory Now
            </button>
          </Link>
          <Link href="/midnight">
            <button className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg border-2 border-gray-200 transition-all">
              Privacy (Midnight)
            </button>
          </Link>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-20">
        <h2 className="text-3xl font-semibold text-center mb-12 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Three simple steps
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-mint-gold rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">
              1
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Upload</h3>
            <p className="text-gray-600 leading-relaxed">
              Choose a photo or image that captures your moment.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-mint-gold rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">
              2
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Add a message</h3>
            <p className="text-gray-600 leading-relaxed">
              Write a short note, memory, or message for the future.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-mint-gold rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">
              3
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>Choose privacy</h3>
            <p className="text-gray-600 leading-relaxed">
              Decide whether it's public, shared, or private.
            </p>
          </div>
        </div>
      </div>

      {/* WordPress Content Section */}
      {posts.length > 0 && (
        <div className="mb-16">
          <h2 className="text-3xl font-semibold text-center mb-10 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
            Useful Minting Tips
          </h2>

          {/* Hero Info Cards */}
          <div className="mb-12">
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Card 1: File Size Limits */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-semibold mb-6 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  If you want a clean starting point:
                </h3>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📸</span>
                    <div>
                      <span className="font-semibold">Images:</span> max 5 MB
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎥</span>
                    <div>
                      <span className="font-semibold">Video:</span> max 25 MB
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎵</span>
                    <div>
                      <span className="font-semibold">Audio:</span> max 5 MB
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-cyan-200">
                    <p className="text-sm leading-relaxed">
                      ✓ Auto-compress everything<br />
                      ✓ Show progress + reassurance
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Supported Formats */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-semibold mb-6 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  Supported Formats
                </h3>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📸</span>
                      <span className="font-semibold">Image</span>
                    </div>
                    <p className="text-sm pl-7">JPG, PNG, WEBP, HEIC</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🎥</span>
                      <span className="font-semibold">Video</span>
                    </div>
                    <p className="text-sm pl-7">MP4, MOV, WEBM</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🎵</span>
                      <span className="font-semibold">Audio</span>
                    </div>
                    <p className="text-sm pl-7">MP3, M4A, WAV</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="max-w-4xl mx-auto mb-12 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500 rounded-r-xl p-6 shadow-md">
            <p className="text-lg text-gray-700 italic leading-relaxed">
              "Your memories can be photos, videos, or voice notes — and file size does not affect blockchain fees."
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.filter((post) => post.title.rendered !== 'Hello world!').map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <h2 className="text-2xl font-semibold mb-3 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
                  {post.title.rendered}
                </h2>
                <div
                  className="text-gray-600 mb-4 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }}
                />
                <Link
                  href={`/guide/${post.slug}`}
                  className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-2"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* No guides available fallback */}
      {posts.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-lg mb-16">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-gray-600 mb-4">
            No guides available yet. Check back soon!
          </p>
          <p className="text-sm text-gray-500">
            (Make sure your WordPress backend is running and has published posts)
          </p>
        </div>
      )}

      {/* CTA Section */}
      <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl p-12 text-center shadow-xl">
        <h2 className="text-3xl font-bold mb-6 text-gray-800" style={{ fontFamily: "'Grape Nuts', cursive" }}>
          Ready to preserve a memory?
        </h2>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          It only takes a few minutes to create something lasting.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/mint">
            <button className="bg-mint-gold hover:bg-amber-500 text-gray-800 font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all">
              Start Now
            </button>
          </Link>
          <Link href="/faq">
            <button className="bg-white hover:bg-gray-50 text-gray-800 font-semibold px-8 py-4 rounded-2xl border-2 border-gray-200 transition-all">
              Have Questions?
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
