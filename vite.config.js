import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // If building for GitHub, use your repo name. If testing locally, use the root!
  base: command === 'build' ? '/lsd-exampaper-generator/' : '/',
}))