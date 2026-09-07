import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { revisionPlugin } from './tooling/revision.mjs'

export default defineConfig({
  plugins: [react(), revisionPlugin()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('node_modules/@apollo/') || id.includes('node_modules/graphql/')) return 'graphql-client'
        },
      },
    },
  },
})
