/**
 * Draws spot lights, split suns and area lights into their atlases, through three's own shadow pass
 * with those lights alone. three's pass takes care of the casters' cull, their draw hooks and the slot's
 * viewport and clear. Its depth material is private, so each caster wears the atlas's depth material
 * as its own `customDepthMaterial` for the draw (r187 `WebGLShadowMap.js:435-439`), which also writes the
 * depth into the atlas's colour for the blocker search.
 */

import type * as THREE from 'three';
import type { AreaShadowLight } from './atlasAreaShadow.js';
import type { AtlasSpotShadow } from './atlasSpotShadow.js';
import { isSplitSun, type SplitSunLight } from '../directionalShadow/splitSun.js';
import { storedDepthRead } from '../directionalShadow/storedDepthRead.js';
import {
  AtlasDepthMaterial,
  FlattenedAtlasDepthMaterial,
  FlattenedFloatAtlasDepthMaterial,
  FloatAtlasDepthMaterial,
  ParaboloidDepthMaterial,
} from './atlasDepthMaterials.js';

/** three's shadow pass as three wrote it, and the shadow map it draws for. */
export interface ThreeShadowPass {
  shadowMap: THREE.WebGLShadowMap;
  draw: THREE.WebGLShadowMap['render'];
}

type SpotShadowLight = THREE.SpotLight & { shadow: AtlasSpotShadow };

/** A light whose casters three projects as it projects them for its own pass. */
export type ProjectedShadowLight = SpotShadowLight | SplitSunLight;

/** The one depth material every spot light's and split sun's casters draw with. */
const atlasDepth = new AtlasDepthMaterial();

/** The one depth material the casters of a split sun with a pancake size draw with. */
const flattenedDepth = new FlattenedAtlasDepthMaterial();

/** The depth materials of a split sun on a page whose directional atlas holds a float colour. */
const floatDepth = new FloatAtlasDepthMaterial();
const flattenedFloatDepth = new FlattenedFloatAtlasDepthMaterial();

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
  for (const depth of PROJECTED_DEPTHS)
    drawWearing(
      pass,
      lights.filter((light) => depthOf(light) === depth),
      depth,
      scene,
      camera
    );
}

const PROJECTED_DEPTHS = [flattenedFloatDepth, floatDepth, flattenedDepth, atlasDepth];

function depthOf(light: ProjectedShadowLight): THREE.MeshDepthMaterial {
  const isFloat = isSplitSun(light) && storedDepthRead() === 'float';
  if (isSplitSun(light) && light.shadow.flattensNearCasters)
    return isFloat ? flattenedFloatDepth : flattenedDepth;
  return isFloat ? floatDepth : atlasDepth;
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
