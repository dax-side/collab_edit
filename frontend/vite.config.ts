import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
    proxy: {
      '/auth': BACKEND_URL,
      '/documents': BACKEND_URL,
      '/ws': {
        target: BACKEND_URL.replace('http', 'ws'),
        ws: true,
      },
    },
  },
  preview: {
    port: 8080,
    host: true,
    allowedHosts: true,
    proxy: {
      '/auth': BACKEND_URL,
      '/documents': BACKEND_URL,
      '/ws': {
        target: BACKEND_URL.replace('http', 'ws'),
        ws: true,
      },
    },
  },
})
