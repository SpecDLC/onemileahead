import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true,
    port: parseInt(process.env.PORT || '5173'),
    strictPort: false,
  },
  preview: {
    host: true,
    port: parseInt(process.env.PORT || '4173'),
    strictPort: false,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'One Mile Ahead',
        short_name: 'OneMileAhead',
        description: 'Texas Historical Markers — look up any marker by number, read inscriptions, discover nearby history.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html}'],
        // Data files (markers.json.gz, fuse-index.json) are fetched on-demand
        // by the app and stored in IndexedDB, not precached by the SW.
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
