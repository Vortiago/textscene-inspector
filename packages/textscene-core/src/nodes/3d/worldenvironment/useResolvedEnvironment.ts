/**
 * Resolves `WorldEnvironment.environment` → `Environment.sky` → `Sky.sky_material`, in the
 * `SubResource` or the `ExtResource` form at every level, as Godot does. A lost sky also loses the
 * ambient an Environment draws from it, so surfaces the sun does not reach go black.
 */

import { useMemo } from 'react';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution, useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { decodeEnvironment } from '../../../resources/environment/decode';
import { createEnvironmentSettings } from '../../../resources/environment/build';
import { useProjectClearColorSrgb } from '../../../r3f/useProjectClearColor';
import type { EnvironmentResolution } from '../../../r3f/environment/WorldEnvironmentScope';
import { NO_RESOLUTION, PENDING_RESOLUTION } from '../../../r3f/environment/worldGroup';
import { decodeSky, decodeSkyMaterial, skyMaterialRef } from '../../../resources/sky/decode';
import type { TscnInternalResource } from '../../../parser/types';
import type { Sky } from '../../../resources/sky/types';
import { perObject } from '../../../utils/perObject';

/**
 * One `Sky` for each Sky resource and material, whichever Environment or camera resolves it, as
 * Godot keeps one radiance for each Sky RID (`sky.h:251`). So viewports that draw one sky share
 * its bake. Null for a material this previewer cannot decode.
 */
const skyOf = perObject((skyResource: TscnInternalResource) =>
  perObject((material: TscnInternalResource): Sky | null => {
    const decoded = decodeSkyMaterial(material.type, material.data);
    return decoded ? decodeSky(skyResource.data, decoded) : null;
  })
);

/**
 * A hook, not a pure function, because the external form loads through the resource pipeline.
 * The resolution is `pending` only while the Environment itself loads. The inline case resolves on
 * the first render, so an all-inline scene resolves in one pass. Each level applies as it resolves
 * (**Progressive fill-in**). Each level's references resolve in the pools of the level that holds
 * them, so a `.tres` reads its own sub-resources.
 */
export function useResolvedEnvironment(environmentRef: string | undefined): EnvironmentResolution {
  const { scoped: environment, status } = useResourceResolution(environmentRef, useSceneResources());
  const envProps = useMemo(
    () =>
      environment?.resource.type === 'Environment' ? decodeEnvironment(environment.resource.data) : null,
    [environment]
  );

  // Hooks run unconditionally with `undefined` when the level above did not resolve.
  // `useSubOrExtResource` short-circuits that to "nothing", so rules of hooks holds
  // whatever shape the chain takes.
  const skyResource = useSubOrExtResource(envProps?.sky, environment?.resources ?? NO_RESOURCES);
  const materialRef = skyMaterialRef(skyResource?.resource.type, skyResource?.resource.data);
  const scopedMaterial = useSubOrExtResource(materialRef, skyResource?.resources ?? NO_RESOURCES);
  const material = scopedMaterial?.resource;
  const skyResources = scopedMaterial?.resources ?? NO_RESOURCES;

  const skyOwner = skyResource?.resource;
  const sky = skyOwner && material ? skyOf(skyOwner)(material) : null;

  const clearColor = useProjectClearColorSrgb();
  // Apart from the sky, so a sky `.tres` that loads later keeps `settings`, and with it the
  // compositor's effect.
  const settings = useMemo(
    () => (envProps ? createEnvironmentSettings(envProps, clearColor) : null),
    [envProps, clearColor]
  );

  return useMemo((): EnvironmentResolution => {
    if (status === 'pending') return PENDING_RESOLUTION;
    if (!settings || !environment) return NO_RESOLUTION;
    return {
      status: 'resolved',
      environment: { settings, sky, resources: environment.resources, skyResources },
    };
  }, [status, settings, environment, sky, skyResources]);
}
