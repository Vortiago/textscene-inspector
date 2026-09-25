/**
 * Resolves `WorldEnvironment.environment` → `Environment.sky` → `Sky.sky_material`, in the
 * `SubResource` or the `ExtResource` form at every level, as Godot does. A lost sky also loses the
 * ambient an Environment draws from it, so surfaces the sun does not reach go black.
 */

import { useMemo } from 'react';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { decodeEnvironment } from '../../../resources/environment/decode';
import { createEnvironmentSettings } from '../../../resources/environment/build';
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
 * in one pass. Each level applies as it resolves (**Progressive fill-in**).
 */
export function useResolvedEnvironment(
  environmentRef: string | undefined
): ResolvedEnvironment | null {
  const { internalResources, externalResources } = useSceneResources();

  const environment = useSubOrExtResource(environmentRef, internalResources, externalResources);
  const envProps = useMemo(
    () =>
      environment?.type === 'Environment'
        ? decodeEnvironment(environment.data as Record<string, string>)
        : null,
    [environment]
  );

  // Hooks run unconditionally with `undefined` when the level above did not resolve;
  // `useSubOrExtResource` short-circuits that to "nothing", so rules of hooks holds
  // whatever shape the chain takes.
  const skyResource = useSubOrExtResource(envProps?.sky, internalResources, externalResources);
  const materialRef = skyMaterialRef(
    skyResource?.type,
    skyResource?.data as Record<string, unknown> | undefined
  );
  const material = useSubOrExtResource(materialRef, internalResources, externalResources);

  const sky = useMemo(
    () => (material ? decodeSkyMaterial(material.type, material.data as Record<string, string>) : null),
    [material]
  );

  return useMemo(
    () => (envProps ? { settings: createEnvironmentSettings(envProps), sky } : null),
    [envProps, sky]
  );
}
