/**
 * Resolves `WorldEnvironment.environment` or `Camera3D.environment` → `Environment.sky` →
 * `Sky.sky_material`, in the `SubResource` or the `ExtResource` form at every level, as Godot does,
 * and the Environment's Texture2D slots. A lost sky also loses the ambient an Environment draws
 * from it, so surfaces the sun does not reach go black.
 */

import { useMemo } from 'react';
import { createEnvironmentSettings } from '../../../resources/environment/build';
import { ENVIRONMENT } from '../../../resources/environment/kind';
import { useNodeResource, useReferencedResource } from '../../../resources/reading';
import { SKY } from '../../../resources/sky/kind';
import { useProjectClearColorSrgb } from '../../../r3f/useProjectClearColor';
import type { EnvironmentResolution } from '../../../r3f/environment/WorldEnvironmentScope';
import { NO_RESOLUTION, PENDING_RESOLUTION } from '../../../r3f/environment/worldGroup';
import { useGlowMap, usePanorama } from './environmentTextures';

/**
 * The resolution is `pending` only while the Environment itself loads. The inline case resolves on
 * the first render, so an all-inline scene resolves in one pass. The sky applies once it resolves
 * (**Progressive fill-in**), and each level's references resolve in the file that holds them.
 */
export function useResolvedEnvironment(environmentRef: string | undefined): EnvironmentResolution {
  const read = useNodeResource(environmentRef, ENVIRONMENT);
  const environment = read.value;
  const skyRead = useReferencedResource(environment?.sky ?? null, SKY);
  const sky = skyRead.value?.sky ?? null;

  const clearColor = useProjectClearColorSrgb();
  // Apart from the sky, so a sky `.tres` that loads later keeps `settings`, and with it the
  // compositor's effect.
  const properties = environment?.properties;
  const settings = useMemo(
    () => (properties ? createEnvironmentSettings(properties, clearColor) : null),
    [properties, clearColor]
  );

  const panorama = usePanorama(skyRead.value?.panorama ?? null);
  const glowMap = useGlowMap(settings, environment?.glowMap ?? null);

  return useMemo((): EnvironmentResolution => {
    if (read.status === 'pending') return PENDING_RESOLUTION;
    if (!settings) return NO_RESOLUTION;
    return { status: 'resolved', environment: { settings, sky, panorama, glowMap } };
  }, [read.status, settings, sky, panorama, glowMap]);
}
