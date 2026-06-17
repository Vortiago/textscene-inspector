import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind on all interfaces so the dev server is reachable from other hosts
    // (LAN / tailnet), not just localhost.
    host: '0.0.0.0',
    port: 3000,
    open: true,
    // Allow access over Tailscale (MagicDNS short name + full FQDN, and any
    // `*.ts.net` tailnet host). Vite 6 blocks unknown Host headers by default.
    allowedHosts: ['thinker', 'thinker.tail437c40.ts.net', '.ts.net'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavyweight three.js vendor into a stable, cacheable
        // chunk — it changes only on dependency bumps, so returning
        // visitors skip re-downloading ~785 KB. ONLY three is split:
        // it is pure self-contained ESM. Splitting the react ecosystem
        // (react/react-dom/scheduler vs react-reconciler inside
        // @react-three/fiber) creates a CJS-interop init cycle across
        // chunks that crashes the app on boot ("Cannot set properties of
        // undefined (setting 'Activity')") — caught by the visual
        // regression harness; do not reintroduce it.
        // Function form: classifies only modules already in the graph
        // (object form treats ids as extra entry points, which both fails
        // under pnpm's strict layout and can pull in unused modules).
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
