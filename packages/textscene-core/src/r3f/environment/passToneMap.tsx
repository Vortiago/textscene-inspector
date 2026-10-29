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
interface PassEnvironmentToneMap {
  /** Null for a pass with no Environment, which keeps Godot's defaults: LINEAR at exposure 1. */
  settings: EnvironmentSettings | null;
  /** The pools the Environment's own references, such as `glow_map`, resolve in. */
  resources: SceneResources;
}

/** What a tonemap pass reads of its viewport pass. */
export interface PassToneMap extends PassEnvironmentToneMap {
  /** Null when the pass's camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
}

const PassToneMapContext = createContext<PassEnvironmentToneMap>({
  settings: null,
  resources: NO_RESOURCES,
});
PassToneMapContext.displayName = 'PassToneMapContext';

/** Gives the tonemap stage below it the Environment its pass draws with. One per viewport pass. */
export function PassToneMapProvider({
  settings,
  resources,
  children,
}: PassEnvironmentToneMap & { children: ReactNode }) {
  const value = useMemo(() => ({ settings, resources }), [settings, resources]);
  return <PassToneMapContext.Provider value={value}>{children}</PassToneMapContext.Provider>;
}

/**
 * What the tonemap of this viewport pass reads: its Environment and its auto exposure.
 *
 * @canonical The Environment a viewport tonemaps with
 */
export function usePassToneMap(): PassToneMap {
  const environment = useContext(PassToneMapContext);
  const autoExposure = useAutoExposure();
  return useMemo(() => ({ ...environment, autoExposure }), [environment, autoExposure]);
}
