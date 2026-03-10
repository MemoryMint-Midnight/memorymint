/**
 * WordPress REST API Integration
 * Fetch content from headless WordPress backend
 */

const WP_API_URL = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'http://localhost/wp-json/wp/v2'

export interface WPPost {
  id: number
  date: string
  slug: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
  }
  excerpt: {
    rendered: string
  }
  featured_media: number
  categories: number[]
  tags: number[]
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url: string
      alt_text: string
    }>
  }
}

export interface WPPage {
  id: number
  date: string
  slug: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
  }
  featured_media: number
}

/**
 * Fetch all posts from WordPress
 */
export async function getPosts(params?: {
  perPage?: number
  page?: number
  categories?: number[]
  orderBy?: string
}): Promise<WPPost[]> {
  try {
    const queryParams = new URLSearchParams()
    queryParams.append('_embed', 'true')

    if (params?.perPage) queryParams.append('per_page', params.perPage.toString())
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.categories) queryParams.append('categories', params.categories.join(','))
    if (params?.orderBy) queryParams.append('orderby', params.orderBy)

    const response = await fetch(`${WP_API_URL}/posts?${queryParams.toString()}`, {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    })

    if (!response.ok) {
      throw new Error('Failed to fetch posts')
    }

    const posts: WPPost[] = await response.json()
    return posts
  } catch (error) {
    console.error('Error fetching posts:', error)
    return []
  }
}

/**
 * Fetch a single post by slug
 */
export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  try {
    const response = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed=true`, {
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch post')
    }

    const posts: WPPost[] = await response.json()
    return posts[0] || null
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

/**
 * Fetch all pages from WordPress
 */
export async function getPages(): Promise<WPPage[]> {
  try {
    const response = await fetch(`${WP_API_URL}/pages?_embed=true`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    })

    if (!response.ok) {
      throw new Error('Failed to fetch pages')
    }

    const pages: WPPage[] = await response.json()
    return pages
  } catch (error) {
    console.error('Error fetching pages:', error)
    return []
  }
}

/**
 * Fetch a single page by slug
 */
export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  try {
    const response = await fetch(`${WP_API_URL}/pages?slug=${slug}&_embed=true`, {
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch page')
    }

    const pages: WPPage[] = await response.json()
    return pages[0] || null
  } catch (error) {
    console.error('Error fetching page:', error)
    return null
  }
}

/**
 * Search WordPress content
 */
export async function searchContent(query: string): Promise<WPPost[]> {
  try {
    const response = await fetch(`${WP_API_URL}/posts?search=${encodeURIComponent(query)}&_embed=true`, {
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error('Failed to search content')
    }

    const posts: WPPost[] = await response.json()
    return posts
  } catch (error) {
    console.error('Error searching content:', error)
    return []
  }
}

/**
 * Get featured image URL from post
 */
export function getFeaturedImageUrl(post: WPPost): string | null {
  if (post._embedded && post._embedded['wp:featuredmedia']) {
    return post._embedded['wp:featuredmedia'][0]?.source_url || null
  }
  return null
}

/**
 * Strip HTML tags from content
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Get excerpt from content (first 150 characters)
 */
export function getExcerpt(content: string, length: number = 150): string {
  const text = stripHtml(content)
  return text.length > length ? text.substring(0, length) + '...' : text
}
