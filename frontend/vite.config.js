import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'app.smartpro.com.vn',
      'client.smartpro.com.vn',
      'soc.smartpro.com.vn',
      'lab.smartpro.com.vn'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/guacamole': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Parse cookies from the incoming browser request
            const cookieHeader = req.headers['cookie'] || '';
            console.log(`[GuacProxy] ${req.method} ${req.url} | cookies: "${cookieHeader}"`);

            const cookies = {};
            cookieHeader.split(';').forEach(c => {
              const parts = c.trim().split('=');
              const k = parts[0];
              const v = parts.slice(1).join('=');
              if (k) cookies[k.trim()] = v;
            });

            // Inject the Remote-User header required by Guacamole header-auth
            const userEmail = cookies['guac_user'];
            if (userEmail) {
              const decoded = decodeURIComponent(userEmail);
              console.log(`[GuacProxy] Injecting Remote-User: ${decoded}`);
              proxyReq.setHeader('Remote-User', decoded);
            } else {
              console.log('[GuacProxy] ⚠️ No guac_user cookie found — Remote-User NOT injected!');
            }
          });
        },
      },
    },
  },
})
