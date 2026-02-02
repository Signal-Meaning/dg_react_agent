import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useHttps = env.HTTPS === 'true' || env.HTTPS === '1'

  return {
    plugins: [
      react(),
      ...(useHttps ? [basicSsl({ name: 'test-app' })] : []),
    ],
    server: {
      host: true, // listen on 0.0.0.0 so 127.0.0.1 and localhost both work (E2E reachability, curl, etc.)
      port: 5173,
      strictPort: true, // Don't try other ports if 5173 is busy
      https: useHttps,
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
  }
})
