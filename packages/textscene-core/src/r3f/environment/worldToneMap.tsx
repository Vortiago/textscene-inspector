/**
 * The Environment a viewport pass tonemaps its 3D render with. Godot's tonemap pass reads the
 * environment its render forces: the camera's, else that of the scenario the viewport renders
 * (`renderer_scene_cull.cpp:3594-3613`), the world `find_world_3d()` resolves
 * (`viewport.cpp:4670-4681`). `ViewportPassEnvironment` provides it, and a SubViewport's tonemap
 * pass reads it.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { NO_RESOURCES, type SceneResources } from '../SceneResourcesContext';
import { useAutoExposure } from './worldExposure';

/** The Environment a viewport pass draws with, as its tonemap pass reads it. */
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

/** Gives the tonemap stage below it the Environment its pass draws with. One per viewport pass. */
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
