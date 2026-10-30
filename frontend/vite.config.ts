import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths: the build works under any folder, e.g. GitHub Pages' /<repo-name>/
  base: './',
  server: {
    // Forward API calls to FastAPI, so phones on the same network only need the Vite address
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
