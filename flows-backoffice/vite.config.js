import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
  proxy: {
    '/api':  { target: 'http://localhost:3000', changeOrigin: true, secure: false },
    '/auth': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
    '/me':   { target: 'http://localhost:3000', changeOrigin: true, secure: false },

    // ✅ specifica
    '/admin/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false },

    '/logout': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
  }
}
})
