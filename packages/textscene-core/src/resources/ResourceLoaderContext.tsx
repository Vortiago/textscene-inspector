/** React context that exposes the per-panel ResourceLoader to descendants, provided by `<TscnPreviewShell>`. */
import { createContext, type ReactNode } from 'react';
import type { ResourceLoader } from './ResourceLoader';

/** `null` until a loader is mounted. */
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
