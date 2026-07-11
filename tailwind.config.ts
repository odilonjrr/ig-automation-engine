import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: '#D97757',
        surface: '#0F0F0F',
      },
    },
  },
  plugins: [],
}
export default config
