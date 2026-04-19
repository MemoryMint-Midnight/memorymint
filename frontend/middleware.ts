import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BYPASS_KEYS = ['mmadmin-jinx', 'mmhelper-pb']

export function middleware(request: NextRequest) {
  const isComingSoon = true

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

  // Check bypass cookie — valid if it matches any known key
  const bypassCookie = request.cookies.get('mm_preview')
  if (bypassCookie && BYPASS_KEYS.includes(bypassCookie.value)) {
    return NextResponse.next()
  }

  // Check ?preview=<key> — sets cookie then redirects to clean URL
  const previewParam = searchParams.get('preview')
  if (previewParam && BYPASS_KEYS.includes(previewParam)) {
    const cleanUrl = new URL(pathname, request.url)
    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set('mm_preview', previewParam, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
    return response
  }

  // Redirect everything else to coming-soon
  return NextResponse.redirect(new URL('/coming-soon', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
