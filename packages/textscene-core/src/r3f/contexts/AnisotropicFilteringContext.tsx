/**
 * The `anisotropic_filtering_level` the textures below draw at. A viewport takes the project's
 * level at construction (`viewport.cpp:5384`) and a SubViewport may set its own, so a portal's
 * subtree provides it and every other subtree reads the project's.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { projectAnisotropicFilteringLevel } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from './ProjectSettingsContext.js';

/** Null: no viewport above sets one, so the project's level holds. */
const AnisotropicFilteringContext = createContext<number | null>(null);
AnisotropicFilteringContext.displayName = 'AnisotropicFilteringContext';

export function AnisotropicFilteringProvider({ level, children }: { level: number; children: ReactNode }) {
  return (
    <AnisotropicFilteringContext.Provider value={level}>{children}</AnisotropicFilteringContext.Provider>
  );
}

export function useAnisotropicFilteringLevel(): number {
  const viewportLevel = useContext(AnisotropicFilteringContext);
  const projectLevel = projectAnisotropicFilteringLevel(useProjectSettings().settings);
  return viewportLevel ?? projectLevel;
}
