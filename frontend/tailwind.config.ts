import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mint-cream': '#ede4d8',
        'mint-yellow': '#ffefc2',
        'mint-gold': '#ffbd59',
      },
      fontFamily: {
        fredoka: ['Fredoka', 'sans-serif'],
        schoolbell: ['Grape Nuts', 'cursive'],
      },
    },
  },
  plugins: [],
}
export default config
