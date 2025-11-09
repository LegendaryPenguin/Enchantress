// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svgr(),   // lets you: import { ReactComponent as Map } from './assets/Map.svg'
    react(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://hackutd2025.eog.systems',
        changeOrigin: true,
        secure: true, // use false only if the upstream has a self-signed cert
      },
    },
  },
})
