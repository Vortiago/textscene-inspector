/**
 * A PointLight2D's shadow: the polar map its quad samples, built from React state, since it depends
 * only on the light's pose and its casters. A DirectionalLight2D's map depends on the camera's frame
 * and is built in a pass step instead (`useDirectionalShadow`).
 */

import { useLayoutEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { Rgba } from '../../../godot/math/math';
import type { Light2DShadowFilter } from '../../../godot/scene/light2d.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { WorldShadowCaster } from '../shadowCasterRegistry';
import { useDisposeOnRelease } from '../../useDisposeOnRelease';
import { buildShadowPolarMap } from './shadowPolarMap';
import {
  createShadowPoseUniforms,
  updateShadowPolarTexture,
  writeShadowPose,
  type ShadowSampling,
} from './shadowSampling';
import { useShadowAtlasSize } from './useShadowAtlasSize';
import { useShadowLightPose } from './shadowLightPose';

/** How the light reads its map: `Light2D.shadow_filter`, `shadow_filter_smooth` and `shadow_color`. */
interface PointShadowLook {
  readonly filter: EnumValue<typeof Light2DShadowFilter>;
  readonly smooth: number;
  readonly shadowColor: Rgba;
}

/**
 * The polar shadow of the light whose cookie `quad` draws, or undefined while it casts none. The
 * pose comes from the quad's own bounds, so the anchor is the quad, not the light node.
 */
export function usePointShadow(
  quad: THREE.Mesh | null,
  casters: readonly WorldShadowCaster[],
  { filter, smooth, shadowColor }: PointShadowLook
): ShadowSampling | undefined {
  const light = useShadowLightPose(quad, casters.length > 0);
  const atlasSize = useShadowAtlasSize();

  // A pure function of the pose, the casters and the atlas size, so it rebuilds exactly when one moves.
  const bins = useMemo(
    () => (light && casters.length > 0 ? buildShadowPolarMap(light, casters, atlasSize) : null),
    [light, casters, atlasSize]
  );

  // The texture outlives each rebuild: both quad materials hold its identity in
  // `uShadowMap`, so an occluder settling during load refills it rather than
  // rebuilding two ShaderMaterials. The refill runs at commit, since a write from
  // a render React discards would reach the materials already on screen.
  const [map, setMap] = useState<THREE.DataTexture | null>(null);
  useLayoutEffect(() => {
    if (!bins) {
      setMap(null);
      return;
    }
    const next = updateShadowPolarTexture(map, bins);
    if (next !== map) setMap(next);
  }, [bins, map]);

  // Keyed on the texture, not on mount, so a light that stops being shadowed
  // (its occluders hidden, or the sub-scene carrying them swapped out) gives
  // the GL object back instead of holding it for the session.
  useDisposeOnRelease(map);

  // Written at commit beside the map refill, so a moving light updates the uniforms its
  // materials already hold instead of rebuilding them.
  const [pose] = useState(createShadowPoseUniforms);
  useLayoutEffect(() => {
    if (light) writeShadowPose(pose, light);
  }, [pose, light]);

  return useMemo(
    () => (map ? { map, filter, smooth, pose, shadowColor } : undefined),
    [map, filter, smooth, pose, shadowColor]
  );
}
