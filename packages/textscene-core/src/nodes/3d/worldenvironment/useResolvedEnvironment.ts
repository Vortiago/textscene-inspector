/**
 * Resolves `WorldEnvironment.environment` → `Environment.sky` → `Sky.sky_material`, in the
 * `SubResource` or the `ExtResource` form at every level, as Godot does. A lost sky also loses the
 * ambient an Environment draws from it, so surfaces the sun does not reach go black.
 */

import { useMemo } from 'react';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { decodeEnvironment } from '../../../resources/environment/decode';
import { createEnvironmentSettings } from '../../../resources/environment/build';
import { useProjectClearColorSrgb } from '../../../r3f/useProjectClearColor';
import type { EnvironmentSettings } from '../../../resources/environment/types';
import { decodeSkyMaterial, skyMaterialRef } from '../../../resources/sky/decode';
import type { SkyProperties } from '../../../resources/sky/types';

export interface ResolvedEnvironment {
  settings: EnvironmentSettings;
  /** Null while a sky `.tres` is loading, and for an environment with no sky. */
  sky: SkyProperties | null;
}

/**
 * A hook, not a pure function, because the external form loads through the resource pipeline.
 * `useSubOrExtResource` returns the inline case on the first render, so an all-inline scene resolves
 * in one pass. Each level applies as it resolves (**Progressive fill-in**). Each level's references
 * resolve in the pools of the level that holds them, so a `.tres` reads its own sub-resources.
 */
export function useResolvedEnvironment(environmentRef: string | undefined): ResolvedEnvironment | null {
  const environment = useSubOrExtResource(environmentRef, useSceneResources());
  const envProps = useMemo(
    () =>
      environment?.resource.type === 'Environment' ? decodeEnvironment(environment.resource.data) : null,
    [environment]
  );

  // Hooks run unconditionally with `undefined` when the level above did not resolve;
  // `useSubOrExtResource` short-circuits that to "nothing", so rules of hooks holds
  // whatever shape the chain takes.
  const skyResource = useSubOrExtResource(envProps?.sky, environment?.resources ?? NO_RESOURCES);
  const materialRef = skyMaterialRef(skyResource?.resource.type, skyResource?.resource.data);
  const material = useSubOrExtResource(materialRef, skyResource?.resources ?? NO_RESOURCES)?.resource;

  const sky = useMemo(() => (material ? decodeSkyMaterial(material.type, material.data) : null), [material]);

  const clearColor = useProjectClearColorSrgb();

  return useMemo(
    () => (envProps ? { settings: createEnvironmentSettings(envProps, clearColor), sky } : null),
    [envProps, clearColor, sky]
  );
}
