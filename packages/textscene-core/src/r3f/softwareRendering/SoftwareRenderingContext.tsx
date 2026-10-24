/**
 * Carries whether the browser draws WebGL in software from the canvases, where the renderer lives,
 * to the top bar. An external store, so a change re-renders only the status.
 */

import type { ExternalStore } from '../hooks/createExternalStore.js';
import { createStoreContext } from '../hooks/createStoreContext.js';

/** False until a canvas reports a software renderer. */
export type SoftwareRenderingStore = ExternalStore<boolean>;

export const {
  Provider: SoftwareRenderingProvider,
  /** The store a canvas's probe publishes into. */
  useStore: useSoftwareRenderingStore,
  /** Whether a canvas draws in software, re-rendering the caller when that changes. */
  useValue: useRendersInSoftware,
} = createStoreContext(false, 'SoftwareRenderingContext');
