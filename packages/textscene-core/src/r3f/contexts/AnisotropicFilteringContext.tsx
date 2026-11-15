/**
 * The `anisotropic_filtering_level` the textures below draw at. A viewport takes the project's
 * level at construction (`viewport.cpp:5384`) and a SubViewport may set its own, so a portal's
 * subtree provides its level, its own or the project's, and every other subtree reads the project's.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useRootViewportDescription } from '../viewportRender/useRootViewportDescription';

/** Undefined outside every SubViewport, where the project's level holds. */
const AnisotropicFilteringContext = createContext<number | undefined>(undefined);
AnisotropicFilteringContext.displayName = 'AnisotropicFilteringContext';

export function AnisotropicFilteringProvider({ level, children }: { level: number; children: ReactNode }) {
  return (
    <AnisotropicFilteringContext.Provider value={level}>{children}</AnisotropicFilteringContext.Provider>
  );
}

export function useAnisotropicFilteringLevel(): number {
  const viewportLevel = useContext(AnisotropicFilteringContext);
  const rootLevel = useRootViewportDescription().anisotropicLevel;
  return viewportLevel ?? rootLevel;
}
