import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// If localhost doesn't work in the browser (e.g. resolves to IPv6 ::1), use 127.0.0.1
// or add "127.0.0.1 localhost" to /etc/hosts so localhost resolves to IPv4.
function localhostHint() {
  return {
    name: 'localhost-hint',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        const scheme = process.env.HTTPS === 'true' || process.env.HTTPS === '1' ? 'https' : 'http'
        console.log(`  ➜  If localhost fails, try: ${scheme}://127.0.0.1:5173/`)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useHttps = env.HTTPS === 'true' || env.HTTPS === '1'

  return {
    plugins: [
      react(),
      localhostHint(),
      ...(useHttps ? [basicSsl({ name: 'test-app' })] : []),
    ],
    // Resolve package to repo source so dev/E2E never use built dist (file:../ would use dist by default)
    resolve: {
      alias: {
        '@signal-meaning/voice-agent-react': path.resolve(__dirname, '..', 'src'),
      },
    },
    server: {
      host: true, // listen on all interfaces (E2E, curl, etc.)
      port: 5173,
      strictPort: true, // Don't try other ports if 5173 is busy
      // Vite typings expect https options object when TLS is on; basic-ssl supplies certs.
      ...(useHttps ? { https: {} } : {}),
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
