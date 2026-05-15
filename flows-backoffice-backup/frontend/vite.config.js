import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_TARGET = 'http://localhost:3002'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    proxy: {
      '/auth': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/me': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/admin/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/logout': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})