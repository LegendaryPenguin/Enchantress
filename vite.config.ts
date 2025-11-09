import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://hackutd2025.eog.systems",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
