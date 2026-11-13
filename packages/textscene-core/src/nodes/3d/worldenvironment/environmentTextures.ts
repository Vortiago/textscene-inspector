/**
 * The Texture2D slots an Environment holds, resolved by the node whose property holds the
 * Environment, so a ViewportTexture counts its path from that node's local scene. Godot sets a
 * ViewportTexture up only when every holder from the property down to it is local to scene
 * (`packed_scene.cpp:701-704`, `core/io/resource.cpp:497-503`).
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { useTexture2D } from '../../../resources/useTexture2D';
import { glowParamsFor, samplesGlowMap } from '../../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../../resources/environment/types';
import type { Sky } from '../../../resources/sky/types';
import type { ScopedResource } from '../../../resources/scopedResource';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext';
import { referenceHeldBy } from '../../../resources/reading';
import { isLocalToScene } from '../../../resources/textures/viewporttexture/localToScene';

/**
 * The texture a PanoramaSkyMaterial samples, in its decoded view, as the shader reads
 * `source_panorama` as `source_color` (`sky_material.cpp:498`). `material` is the scoped material
 * that names it, and `isHeldLocally` is whether the Environment, the Sky and the material are all
 * local to scene. Null for any other sky, and while the texture loads.
 */
export function usePanorama(
  sky: Sky | null,
  material: ScopedResource | null,
  isHeldLocally: boolean
): THREE.Texture | null {
  const ref = sky?.material.kind === 'panorama' ? sky.material.panorama : undefined;
  const resources = material?.resources ?? NO_RESOURCES;
  return useTexture2D(referenceHeldBy(ref, resources, isHeldLocally), 'decoding').texture;
}

/**
 * The texture `glow_map` names, in its raw view (`renderer_scene_render_rd.cpp:707`), held by the
 * Environment alone. Null while it loads, and when the composite samples no map, so an unsampled
 * map never loads.
 */
export function useGlowMap(
  settings: EnvironmentSettings | null,
  environment: ScopedResource | null
): THREE.Texture | null {
  const ref = useMemo(() => {
    const glow = settings && glowParamsFor(settings);
    return glow && samplesGlowMap(glow) ? glow.map : undefined;
  }, [settings]);
  const isHeldLocally = !!environment && isLocalToScene(environment.resource);
  const reference = referenceHeldBy(ref, environment?.resources ?? NO_RESOURCES, isHeldLocally);
  return useTexture2D(reference, 'plain').texture;
}
