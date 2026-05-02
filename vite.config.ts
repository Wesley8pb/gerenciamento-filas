import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'

const supabaseProxyAgent = new https.Agent({ keepAlive: false });

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/supabase-api': {
        target: 'https://ifndiztgonndotoleefo.supabase.co',
        changeOrigin: true,
        agent: supabaseProxyAgent,
        timeout: 30000,
        proxyTimeout: 30000,
        rewrite: (path) => path.replace(/^\/supabase-api/, ''),
      },
    },
  },
})
