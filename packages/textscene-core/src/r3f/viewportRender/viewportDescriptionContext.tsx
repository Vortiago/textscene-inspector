import { createContext, useContext, type ReactNode } from 'react';
import { useRootViewportDescription } from './useRootViewportDescription.js';
import type { ViewportDescription } from './viewportDescription.js';

/** Undefined outside every SubViewport, where the root's description holds. */
const ViewportDescriptionContext = createContext<ViewportDescription | undefined>(undefined);
ViewportDescriptionContext.displayName = 'ViewportDescriptionContext';

export function ViewportDescriptionProvider({
  description,
  children,
}: {
  description: ViewportDescription;
  children: ReactNode;
}) {
  return (
    <ViewportDescriptionContext.Provider value={description}>{children}</ViewportDescriptionContext.Provider>
  );
}

export function useViewportDescription(): ViewportDescription {
  const subViewport = useContext(ViewportDescriptionContext);
  const root = useRootViewportDescription();
  return subViewport ?? root;
}
