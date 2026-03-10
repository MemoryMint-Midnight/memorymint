/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export — uploaded directly to Stellar / cPanel hosting.
  // Next.js image optimisation requires a server, so we use unoptimized mode.
  output: 'export',
  trailingSlash: true,   // generates /mint/index.html — works cleanly on Apache
  images: {
    unoptimized: true,   // required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.memorymint.fun',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'memorymint.local',
        port: '',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
