import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import type { WorkCount } from './workCount';
import { createViewWork, type ViewWork } from './viewWork';
import { createSettledFonts, type SettledFonts } from '../r3f/controls/native/text/settledFonts';
import { perObject } from '../utils/perObject';

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
const ViewWorkContext = createContext<ViewWork | null>(null);
ViewWorkContext.displayName = 'ViewWorkContext';

/** Null outside a provider. */
const SettledFontsContext = createContext<SettledFonts | null>(null);
SettledFontsContext.displayName = 'SettledFontsContext';

/** Two views on one loader neither wait on each other's work nor wake on each other's font settles. */
export function ResourceLoaderProvider({ loader, children }: ResourceLoaderProviderProps) {
  const [work] = useState(createViewWork);
  // In state, not a memo: React may drop a memo, and a new store wakes no reader of the old one.
  const [fontsOf] = useState(() =>
    perObject((l: ResourceLoader) => createSettledFonts(l.loadFace, work.fonts))
  );
  const fonts = fontsOf(loader);
  return (
    <ResourceLoaderContext.Provider value={loader}>
      <ViewWorkContext.Provider value={work}>
        <SettledFontsContext.Provider value={fonts}>{children}</SettledFontsContext.Provider>
      </ViewWorkContext.Provider>
    </ResourceLoaderContext.Provider>
  );
}

/** The loader from context, or null outside the provider. */
export function useResourceLoader(): ResourceLoader | null {
  return useContext(ResourceLoaderContext);
}

/** Null outside a provider, where nothing counts. */
export function useViewWork(): ViewWork | null {
  return useContext(ViewWorkContext);
}

/** The loads the nearest provider's consumers wait on. */
export function usePendingLoads(): WorkCount | null {
  return useViewWork()?.resources ?? null;
}

/** The settled fonts of the nearest provider's view, or null outside one. */
export function useViewSettledFonts(): SettledFonts | null {
  return useContext(SettledFontsContext);
}
