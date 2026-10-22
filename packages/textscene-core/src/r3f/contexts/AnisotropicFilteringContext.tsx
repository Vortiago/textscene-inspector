/**
 * The `anisotropic_filtering_level` the textures below draw at. A viewport takes the project's
 * level at construction (`viewport.cpp:5384`) and a SubViewport may set its own, so a portal's
 * subtree provides the authored level and every other subtree reads the project's.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { projectAnisotropicFilteringLevel } from '../../parser/projectSettingsParser';
import { useProjectSettings } from './ProjectSettingsContext';

/** Undefined: the viewport above authors no level, so the project's holds. */
const AnisotropicFilteringContext = createContext<number | undefined>(undefined);
AnisotropicFilteringContext.displayName = 'AnisotropicFilteringContext';

export function AnisotropicFilteringProvider({
  level,
  children,
}: {
  level: number | undefined;
  children: ReactNode;
}) {
  return (
    <AnisotropicFilteringContext.Provider value={level}>{children}</AnisotropicFilteringContext.Provider>
  );
}

export function useAnisotropicFilteringLevel(): number {
  const viewportLevel = useContext(AnisotropicFilteringContext);
  const { settings } = useProjectSettings();
  return viewportLevel ?? projectAnisotropicFilteringLevel(settings);
}
