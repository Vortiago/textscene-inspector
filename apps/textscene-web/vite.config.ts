import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { isPublicSiteBuild } from './scripts/siteEdition.mjs';

const isPublicSite = isPublicSiteBuild();

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: GitHub Pages serves the public edition under /<repo>/, not at
  // the root. The dev edition keeps `/`, as its `/fixtures/` fetches are root-absolute too.
  base: isPublicSite ? './' : '/',
  // public/ holds only dev content (the fixtures mirror and the parity gallery), so the
  // public edition copies none of it, whatever an earlier dev build left there.
  publicDir: isPublicSite ? false : 'public',
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
    // The public edition ships no source maps: only a debugger reads them, and they
    // more than double the size of dist/.
    sourcemap: !isPublicSite,
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
