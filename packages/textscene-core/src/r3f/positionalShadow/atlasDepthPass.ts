/**
 * Draws spot lights, split suns and area lights into their atlases, through three's own shadow pass
 * with those lights alone. three's pass takes care of the casters' cull, their draw hooks and the slot's
 * viewport and clear. Its depth material is private, so each caster wears the atlas's depth material
 * as its own `customDepthMaterial` for the draw (`WebGLShadowMap.js:430-436`), which also writes the
 * depth into the atlas's colour for the blocker search.
 */

import type * as THREE from 'three';
import type { AreaShadowLight } from './atlasAreaShadow.js';
import type { AtlasSpotShadow } from './atlasSpotShadow.js';
import type { SplitSunLight } from '../directionalShadow/splitSun.js';
import { AtlasDepthMaterial, ParaboloidDepthMaterial } from './atlasDepthMaterials.js';

/** three's shadow pass as three wrote it, and the shadow map it draws for. */
export interface ThreeShadowPass {
  shadowMap: THREE.WebGLShadowMap;
  draw: THREE.WebGLShadowMap['render'];
}

export type SpotShadowLight = THREE.SpotLight & { shadow: AtlasSpotShadow };

/** A light whose casters three projects as it projects them for its own pass. */
export type ProjectedShadowLight = SpotShadowLight | SplitSunLight;

/** The one depth material every spot light's and split sun's casters draw with. */
const atlasDepth = new AtlasDepthMaterial();

/** The one depth material every area light's casters draw with: each vertex bent onto its paraboloid. */
const areaDepth = new ParaboloidDepthMaterial();

/**
 * Draws `lights`, each of which holds its place in an atlas. The caller decides that the pass draws
 * this frame: three's pass clears the map's `needsUpdate`, so this sets it again.
 */
export function drawProjectedShadows(
  pass: ThreeShadowPass,
  lights: readonly ProjectedShadowLight[],
  scene: THREE.Scene,
  camera: THREE.Camera
): void {
  drawWearing(pass, lights, atlasDepth, scene, camera);
}

/** Draws `lights` as `drawProjectedShadows` does, each caster bent onto the light's paraboloid. */
export function drawAreaShadows(
  pass: ThreeShadowPass,
  lights: readonly AreaShadowLight[],
  scene: THREE.Scene,
  camera: THREE.Camera
): void {
  drawWearing(pass, lights, areaDepth, scene, camera);
}

function drawWearing(
  { shadowMap, draw }: ThreeShadowPass,
  lights: readonly (ProjectedShadowLight | AreaShadowLight)[],
  depth: THREE.MeshDepthMaterial,
  scene: THREE.Scene,
  camera: THREE.Camera
): void {
  if (lights.length === 0) return;
  for (const light of lights) light.shadow.needsUpdate = true;
  shadowMap.needsUpdate = true;
  const casters = wear(scene, depth);
  try {
    draw([...lights], scene, camera);
  } finally {
    restoreDepth(casters);
  }
}

/** Each caster and the depth material it wore before. */
type WornDepth = [THREE.Object3D, THREE.Material | undefined][];

function wear(scene: THREE.Object3D, depth: THREE.Material): WornDepth {
  const casters: WornDepth = [];
  scene.traverse((object) => {
    if (!object.castShadow) return;
    casters.push([object, object.customDepthMaterial]);
    object.customDepthMaterial = depth;
  });
  return casters;
}

function restoreDepth(casters: WornDepth): void {
  for (const [object, depth] of casters) object.customDepthMaterial = depth;
}
