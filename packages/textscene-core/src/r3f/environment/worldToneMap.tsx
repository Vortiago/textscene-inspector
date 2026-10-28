/**
 * The Environment a world's viewports tonemap their 3D render with. Godot's tonemap pass reads the
 * environment of the scenario the viewport renders (`renderer_scene_cull.cpp:3594-3613`), which is
 * the world `find_world_3d()` resolves (`viewport.cpp:4670-4681`). The layer that applies a world's
 * Environment publishes it here, and a SubViewport's tonemap pass reads it.
 */

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { NO_RESOURCES, type SceneResources } from '../SceneResourcesContext';
import { useAutoExposure } from './worldExposure';

/** What a tonemap pass reads of its world. */
export interface WorldToneMap {
  /** Null for a world with no Environment, whose pass keeps Godot's defaults: LINEAR at exposure 1. */
  settings: EnvironmentSettings | null;
  /** The pools the Environment's own references, such as `glow_map`, resolve in. */
  resources: SceneResources;
  /** Null when the world's camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
}

/** A world with no Environment and no auto exposure. */
export const NO_WORLD_TONE_MAP: WorldToneMap = {
  settings: null,
  resources: NO_RESOURCES,
  autoExposure: null,
};

interface WorldEnvironmentToneMap {
  settings: EnvironmentSettings | null;
  resources: SceneResources;
}

const NO_ENVIRONMENT: WorldEnvironmentToneMap = { settings: null, resources: NO_RESOURCES };

interface Slot {
  environment: WorldEnvironmentToneMap;
  publish: (environment: WorldEnvironmentToneMap) => void;
}

const WorldToneMapContext = createContext<Slot>({ environment: NO_ENVIRONMENT, publish: () => {} });
WorldToneMapContext.displayName = 'WorldToneMapContext';

/** Holds the Environment of the world below it. One per world, above its Environment layer. */
export function WorldToneMapScope({ children }: { children: ReactNode }) {
  const [environment, publish] = useState(NO_ENVIRONMENT);
  const slot = useMemo(() => ({ environment, publish }), [environment]);
  return <WorldToneMapContext.Provider value={slot}>{children}</WorldToneMapContext.Provider>;
}

/** Puts the Environment the layer applies in its world, until the layer unmounts. */
export function usePublishWorldToneMap(settings: EnvironmentSettings, resources: SceneResources): void {
  const { publish } = useContext(WorldToneMapContext);
  useLayoutEffect(() => {
    publish({ settings, resources });
    return () => publish(NO_ENVIRONMENT);
  }, [publish, settings, resources]);
}

/** What a tonemap pass of this world reads: its Environment and its auto exposure. */
export function useWorldToneMap(): WorldToneMap {
  const { environment } = useContext(WorldToneMapContext);
  const autoExposure = useAutoExposure();
  return useMemo(() => ({ ...environment, autoExposure }), [environment, autoExposure]);
}

/**
 * Hands this world's tone map to a reader outside it: an own-world SubViewport's pass sits outside
 * the portal its world mounts in.
 */
export function ReportWorldToneMap({ onChange }: { onChange: (toneMap: WorldToneMap) => void }) {
  const toneMap = useWorldToneMap();
  useLayoutEffect(() => onChange(toneMap), [onChange, toneMap]);
  return null;
}
