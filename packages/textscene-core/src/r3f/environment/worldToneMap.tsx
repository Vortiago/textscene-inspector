/**
 * The Environment a world's viewports tonemap their 3D render with. Godot's tonemap pass reads the
 * environment of the scenario the viewport renders (`renderer_scene_cull.cpp:3594-3613`), which is
 * the world `find_world_3d()` resolves (`viewport.cpp:4670-4681`). The world's chooser provides it
 * (`WorldEnvironmentScope.tsx`), and a SubViewport's tonemap pass reads it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { NO_RESOURCES, type SceneResources } from '../SceneResourcesContext';
import { useAutoExposure } from './worldExposure';

/** The Environment a world applies, as its tonemap pass reads it. */
interface WorldEnvironmentToneMap {
  /** Null for a world with no Environment, whose pass keeps Godot's defaults: LINEAR at exposure 1. */
  settings: EnvironmentSettings | null;
  /** The pools the Environment's own references, such as `glow_map`, resolve in. */
  resources: SceneResources;
}

/** What a tonemap pass reads of its world. */
export interface WorldToneMap extends WorldEnvironmentToneMap {
  /** Null when the world's camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
}

const WorldToneMapContext = createContext<WorldEnvironmentToneMap>({
  settings: null,
  resources: NO_RESOURCES,
});
WorldToneMapContext.displayName = 'WorldToneMapContext';

/** Gives the world below it the Environment its chooser applies. One per world. */
export function WorldToneMapProvider({
  settings,
  resources,
  children,
}: WorldEnvironmentToneMap & { children: ReactNode }) {
  const value = useMemo(() => ({ settings, resources }), [settings, resources]);
  return <WorldToneMapContext.Provider value={value}>{children}</WorldToneMapContext.Provider>;
}

/**
 * What a tonemap pass of this world reads: its Environment and its auto exposure.
 *
 * @canonical The Environment a viewport tonemaps with
 */
export function useWorldToneMap(): WorldToneMap {
  const environment = useContext(WorldToneMapContext);
  const autoExposure = useAutoExposure();
  return useMemo(() => ({ ...environment, autoExposure }), [environment, autoExposure]);
}
