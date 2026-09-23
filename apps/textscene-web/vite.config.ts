import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // All interfaces, so other hosts on the LAN or tailnet reach the dev server.
    host: '0.0.0.0',
    port: 3000,
    open: true,
    // Tailscale MagicDNS hosts: Vite 6 blocks unknown Host headers by default.
    allowedHosts: ['.ts.net'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // three.js gets its own cacheable chunk, as it changes only on a dependency bump. Only
      // three, which is self-contained ESM: a split react ecosystem forms a CJS-interop init
      // cycle across chunks that crashes the app on boot ("Cannot set properties of undefined
      // (setting 'Activity')").
      output: {
        // The function form classifies only modules in the graph. The object form treats ids as
        // entry points, which fails under pnpm's strict layout and can pull in unused modules.
        manualChunks(id: string): string | undefined {
          if (id.includes('/node_modules/') && (id.includes('/three/') || id.includes('/three@'))) {
            return 'three';
          }
          return undefined;
        },
      },
    },
  },
});
