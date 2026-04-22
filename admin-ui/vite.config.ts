import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Admin Dashboard — dedicated port 3092
// Chat UI runs on 3090, RAG API on 3091, Admin here on 3092
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3092,
    strictPort: true, // fail fast if port is taken rather than silently picking another
    open: false,
  },
})
