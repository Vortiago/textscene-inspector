import { fileURLToPath } from 'node:url';

// The source, not the bundle, so the view and the shell's panels share one copy of core's modules.
export const WORKSPACE_RENDERER_ALIAS = {
  '@textscene/renderer': fileURLToPath(new URL('../apps/textscene-renderer/src/index.ts', import.meta.url)),
};
