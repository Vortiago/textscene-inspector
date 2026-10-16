/**
 * Carries the frame profile's latest window from the canvas, where the profile runs, to the overlay
 * beside it. An external store, so a published window re-renders only the overlay.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  createExternalStore,
  useExternalStoreValue,
  type ExternalStore,
} from '../hooks/createExternalStore.js';
import type { FrameStats } from './frameStats.js';

/** Null while no profile runs, and before a running one publishes its first window. */
type FrameStatsStore = ExternalStore<FrameStats | null>;

/** Without a provider, a profile publishes into this store, which nothing reads. */
const UNREAD_STORE: FrameStatsStore = createExternalStore<FrameStats | null>(null);

const FrameStatsContext = createContext<FrameStatsStore>(UNREAD_STORE);
FrameStatsContext.displayName = 'FrameStatsContext';

export function FrameStatsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createExternalStore<FrameStats | null>(null));
  return <FrameStatsContext.Provider value={store}>{children}</FrameStatsContext.Provider>;
}

/** The store a running profile publishes into. */
export function useFrameStatsStore(): FrameStatsStore {
  return useContext(FrameStatsContext);
}

/** The latest window, re-rendering the caller on each new one. */
export function useFrameStats(): FrameStats | null {
  return useExternalStoreValue(useFrameStatsStore());
}
