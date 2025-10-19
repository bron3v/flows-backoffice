// vite.config.js
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
  proxy: {
    '/admin/api': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
    '/auth':      { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
    '/me':        { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
    '/api':       { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false },
  },
  configureServer(server) {
    server.middlewares.use((req,_res,next)=>{
      if (/^(\/auth|\/me|\/admin)/.test(req.url)) console.log('[vite→proxy]', req.method, req.url)
      next()
    })
  }
}

})
