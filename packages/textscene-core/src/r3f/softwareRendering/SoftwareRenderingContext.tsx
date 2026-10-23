/**
 * Carries whether the browser draws WebGL in software from the canvases, where the renderer lives,
 * to the top bar. An external store, so a change re-renders only the status.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  createExternalStore,
  useExternalStoreValue,
  type ExternalStore,
} from '../hooks/createExternalStore.js';

/** False until a canvas reports a software renderer. */
export type SoftwareRenderingStore = ExternalStore<boolean>;

/** Without a provider, a probe publishes into this store, which nothing reads. */
const UNREAD_STORE: SoftwareRenderingStore = createExternalStore(false);

const SoftwareRenderingContext = createContext<SoftwareRenderingStore>(UNREAD_STORE);
SoftwareRenderingContext.displayName = 'SoftwareRenderingContext';

export function SoftwareRenderingProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createExternalStore(false));
  return <SoftwareRenderingContext.Provider value={store}>{children}</SoftwareRenderingContext.Provider>;
}

/** The store a canvas's probe publishes into. */
export function useSoftwareRenderingStore(): SoftwareRenderingStore {
  return useContext(SoftwareRenderingContext);
}

/** Whether a canvas draws in software, re-rendering the caller when that changes. */
export function useRendersInSoftware(): boolean {
  return useExternalStoreValue(useSoftwareRenderingStore());
}
