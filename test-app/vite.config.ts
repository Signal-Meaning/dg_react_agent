import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Don't try other ports if 5173 is busy
    fs: {
      allow: ['..', '../..', '../../..']
    }
  },
  // Serve test fixtures including audio samples
  publicDir: 'public',
  // Additional configuration for serving audio samples
  define: {
    __AUDIO_SAMPLES_PATH__: JSON.stringify('/audio-samples/')
  }
})
