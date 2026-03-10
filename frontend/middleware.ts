import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BYPASS_KEY = process.env.COMING_SOON_BYPASS || 'mmpreview'

export function middleware(request: NextRequest) {
  const isComingSoon = process.env.COMING_SOON === 'true'

  if (!isComingSoon) return NextResponse.next()

  const { pathname, searchParams } = request.nextUrl

  // Always allow: Next.js internals, API routes, static files, the page itself
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/coming-soon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check bypass cookie — allows full site access for 24h after using the preview key
  const bypassCookie = request.cookies.get('mm_preview')
  if (bypassCookie?.value === BYPASS_KEY) {
    return NextResponse.next()
  }

  // Check ?preview=<key> in URL — sets cookie then redirects to clean URL
  const previewParam = searchParams.get('preview')
  if (previewParam === BYPASS_KEY) {
    const cleanUrl = new URL(pathname, request.url)
    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set('mm_preview', BYPASS_KEY, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    })
    return response
  }

  // Redirect everything else to coming-soon
  return NextResponse.redirect(new URL('/coming-soon', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
