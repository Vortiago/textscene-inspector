/**
 * R3F webview entry point. Mounted by webview.ts when the
 * `textscene.useR3F` workspace setting is true. The HTML scaffold gives
 * us a `#r3f-root` div in place of the imperative tree-viewer + canvas
 * layout. Until WI-R3F-3 / WI-R3F-4 land node components and the React
 * panel UI, this renders only the empty <TscnCanvas>.
 */
import { createRoot } from 'react-dom/client';
import { TscnCanvas } from '@textscene/core';

export function mountR3FWebview(): void {
  const root = document.getElementById('r3f-root');
  if (!root) {
    throw new Error('R3F webview HTML is missing #r3f-root container');
  }
  createRoot(root).render(<TscnCanvas />);
}
