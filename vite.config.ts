import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', hmr: false, proxy: { '/telemetry': 'http://127.0.0.1:8000', '/status': 'http://127.0.0.1:8000', '/account': 'http://127.0.0.1:8000', '/positions': 'http://127.0.0.1:8000', '/version': 'http://127.0.0.1:8000' } },
})
