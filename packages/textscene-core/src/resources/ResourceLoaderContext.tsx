import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import { createImmediateWorkCount, type WorkCount } from './workCount';

/**
 * Frames a load's consumers take to commit after the loader settles. They commit within a render
 * or two of its last event, so ten cover them with room to spare.
 */
export const COMMIT_FRAMES_AFTER_SETTLE = 10;

/** `null` until a loader is mounted. */
const ResourceLoaderContext = createContext<ResourceLoader | null>(null);

export interface ResourceLoaderProviderProps {
  loader: ResourceLoader;
  children: ReactNode;
}

/** Null outside a provider, where nothing counts. */
const PendingLoadsContext = createContext<WorkCount | null>(null);
PendingLoadsContext.displayName = 'PendingLoadsContext';

/** Each provider counts its own consumers' loads, so two views on one loader do not wait on each other. */
export function ResourceLoaderProvider({ loader, children }: ResourceLoaderProviderProps) {
  const [pending] = useState(createImmediateWorkCount);
  return (
    <ResourceLoaderContext.Provider value={loader}>
      <PendingLoadsContext.Provider value={pending}>{children}</PendingLoadsContext.Provider>
    </ResourceLoaderContext.Provider>
  );
}

/** The loader from context, or null outside the provider. */
export function useResourceLoader(): ResourceLoader | null {
  return useContext(ResourceLoaderContext);
}

/** The loads the nearest provider's consumers wait on. */
export function usePendingLoads(): WorkCount | null {
  return useContext(PendingLoadsContext);
}
