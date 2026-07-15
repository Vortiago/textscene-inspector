/**
 * React context that exposes the per-panel ResourceLoader to descendants.
 * Provided by `<TscnPreviewShell>` alongside SelectionContext
 * and HierarchyContext. Consumed by `useResource` and any future hooks
 * that want to drive the event bus without prop-drilling.
 */
import { createContext, type ReactNode } from 'react';
import type { ResourceLoader } from './ResourceLoader';

/**
 * The context value is `null` until a loader is mounted. Hooks that need
 * the loader should throw a clear error in development if they're called
 * outside the provider boundary — see `useResourceLoader` below.
 */
export const ResourceLoaderContext = createContext<ResourceLoader | null>(null);

export interface ResourceLoaderProviderProps {
  loader: ResourceLoader;
  children: ReactNode;
}

export function ResourceLoaderProvider({
  loader,
  children,
}: ResourceLoaderProviderProps) {
  return (
    <ResourceLoaderContext.Provider value={loader}>
      {children}
    </ResourceLoaderContext.Provider>
  );
}
