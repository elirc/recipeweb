import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' + HashRouter means the production build works on any static host
// (Vercel, Netlify, GitHub Pages subpaths) with zero server configuration.
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
})
