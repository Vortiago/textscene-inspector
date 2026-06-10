import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split heavyweight vendors into stable, cacheable chunks instead
        // of one ~1.4 MB monolith — three and react change only on
        // dependency bumps, so returning visitors skip re-downloading them.
        // Function form: classifies only modules already in the graph
        // (object form treats ids as extra entry points, which both fails
        // under pnpm's strict layout and can pull in unused modules).
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/') || id.includes('/three@')) return 'three';
          if (id.includes('@react-three/')) return 'r3f';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
