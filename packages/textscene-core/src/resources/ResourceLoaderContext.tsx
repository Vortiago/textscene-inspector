/** React context that exposes the per-panel ResourceLoader to descendants, provided by `<TscnPreviewShell>`. */
import { createContext, type ReactNode } from 'react';
import type { ResourceLoader } from './ResourceLoader';

/**
 * Frames a load's consumers take to commit after the loader settles. They commit within a render
 * or two of its last event, so ten cover them with room to spare.
 */
export const COMMIT_FRAMES_AFTER_SETTLE = 10;

/** `null` until a loader is mounted. */
export const ResourceLoaderContext = createContext<ResourceLoader | null>(null);

export interface ResourceLoaderProviderProps {
  loader: ResourceLoader;
  children: ReactNode;
}

export function ResourceLoaderProvider({ loader, children }: ResourceLoaderProviderProps) {
  return <ResourceLoaderContext.Provider value={loader}>{children}</ResourceLoaderContext.Provider>;
}
