import { createContext, useContext, type ReactNode } from 'react';
import { useRootViewportDescription } from '../viewportRender/useRootViewportDescription';

/** Undefined outside every SubViewport, where the project's level holds (`viewport.cpp:5384`). */
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
