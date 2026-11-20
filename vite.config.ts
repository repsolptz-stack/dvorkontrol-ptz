import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dvorcontrol-ptz/',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'leaflet.markercluster'],
        },
      },
    },
  },
  server: { host: true },
});
