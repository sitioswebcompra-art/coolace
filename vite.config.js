import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const serviceWorkerTemplate = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')

const pwaServiceWorker = {
  name: 'coolace-pwa-service-worker',
  generateBundle(_, bundle) {
    const buildAssets = Object.keys(bundle)
      .filter((file) => /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?|ttf|otf)$/i.test(file))
      .map((file) => `/${file}`)
    const entry = Object.values(bundle).find((file) => file.type === 'chunk' && file.isEntry)
    const buildId = entry?.fileName.split('/').pop().replace(/\.[^.]+$/, '') || 'v1'
    const serviceWorker = serviceWorkerTemplate
      .replace("const CACHE_NAME = 'coolace-shell-v1';", `const CACHE_NAME = 'coolace-shell-${buildId}';`)
      .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(buildAssets)};`)
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker })
  },
}

export default defineConfig({
  plugins: [react(), pwaServiceWorker],
})