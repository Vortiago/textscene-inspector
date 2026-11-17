import { useMemo } from 'react';
import { useEnvironmentOf } from '../../nodes/3d/worldenvironment/useResolvedEnvironment';
import { referenceHeldBy } from '../../resources/reading';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext';
import type { EnvironmentResolution } from './WorldEnvironmentScope';

/** A viewport with no fallback, and a fallback that fails to load, resolve to none. */
export function useFallbackEnvironment(): EnvironmentResolution {
  const path = useViewportDescription().fallbackEnvironment;
  // A project setting is held by no scene, so no holder makes it local to one.
  const reference = useMemo(() => (path ? referenceHeldBy(path, NO_RESOURCES, false) : null), [path]);
  return useEnvironmentOf(reference);
}
