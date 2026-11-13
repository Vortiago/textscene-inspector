/**
 * The Texture2D slots an Environment holds, each a reference the decode handed on. The reference
 * carries whether every holder from the node's property down to it is local to scene, which
 * decides whether Godot sets a ViewportTexture up (`packed_scene.cpp:701-704`,
 * `core/io/resource.cpp:497-503`).
 */

import type * as THREE from 'three';
import { useTexture2D } from '../../../resources/useTexture2D';
import { glowParamsFor, samplesGlowMap } from '../../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../../resources/environment/types';
import type { ScopedReference } from '../../../resources/reading';

/**
 * The texture a PanoramaSkyMaterial samples, in its decoded view, as the shader reads
 * `source_panorama` as `source_color` (`sky_material.cpp:498`). Null for no panorama, and while
 * the texture loads.
 */
export function usePanorama(panorama: ScopedReference | null): THREE.Texture | null {
  return useTexture2D(panorama, 'decoding').texture;
}

/**
 * The texture `glow_map` names, in its raw view (`renderer_scene_render_rd.cpp:707`). Null while it
 * loads, and when the composite samples no map, so an unsampled map never loads.
 */
export function useGlowMap(
  settings: EnvironmentSettings | null,
  glowMap: ScopedReference | null
): THREE.Texture | null {
  const glow = settings && glowParamsFor(settings);
  return useTexture2D(glow && samplesGlowMap(glow) ? glowMap : null, 'plain').texture;
}
