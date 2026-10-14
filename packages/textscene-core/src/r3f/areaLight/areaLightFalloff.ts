/**
 * Each area light's Godot terms that three's `RectAreaLight` struct lacks, in uniform arrays that
 * every lit program reads by the light's index: the view-space direction the light shines in, its
 * range, attenuation and specular amount, and where its `area_texture` lies in the atlas. The
 * scene's light pass (`SceneShadowFitter.tsx`) writes them before each render, in the order three
 * gives its rect area lights their slots, after it brings the atlas up to date.
 */

import * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { slottedLights } from '../lightSlots.js';
import { LightUniformArrays, type LightArrays } from '../shaderPatch/lightUniformArrays.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { writeAreaLightShadowUniforms } from './areaLightShadowUniforms.js';
import { areaTexturePlacement } from './areaLightAtlas.js';

export const AREA_LIGHT_FACINGS = 'rectAreaLightFacings';
export const AREA_LIGHT_FALLOFFS = 'rectAreaLightFalloffs';
export const AREA_LIGHT_TEXTURE_RECTS = 'rectAreaLightTextureRects';
export const AREA_LIGHT_TEXTURE_MIPMAPS = 'rectAreaLightTextureMipmaps';
type AreaLightUniform =
  | typeof AREA_LIGHT_FACINGS
  | typeof AREA_LIGHT_FALLOFFS
  | typeof AREA_LIGHT_TEXTURE_RECTS
  | typeof AREA_LIGHT_TEXTURE_MIPMAPS;

/** An AreaLight3D's `area_range`, `area_attenuation` and `light_specular`. */
export interface AreaLightFalloff {
  range: number;
  attenuation: number;
  specular: number;
}

const falloffDeclaration = userDataDeclaration<AreaLightFalloff>(
  'godotAreaLightFalloff',
  ({ range, attenuation, specular }) =>
    typeof range === 'number' && typeof attenuation === 'number' && typeof specular === 'number'
);

/** The `userData` through which a `RectAreaLight` carries its falloff to the writer. */
export function areaLightUserData(falloff: AreaLightFalloff): Record<string, unknown> {
  return falloffDeclaration.userData(falloff);
}

/** The falloff `areaLightUserData` declared, or null for a light that declared none. */
export function readAreaLightFalloff(light: THREE.RectAreaLight): AreaLightFalloff | null {
  return falloffDeclaration.read(light);
}

/** Written only by `writeAreaLightUniforms`. */
const arrays = new LightUniformArrays({
  [AREA_LIGHT_FACINGS]: 3,
  [AREA_LIGHT_FALLOFFS]: 3,
  [AREA_LIGHT_TEXTURE_RECTS]: 4,
  [AREA_LIGHT_TEXTURE_MIPMAPS]: 1,
});

/** Where the light's texture lies in the atlas, and the highest mip the shader reads. */
function writeTexture(set: LightArrays<AreaLightUniform>, index: number, light: THREE.RectAreaLight): void {
  const { rect, maxMipmap } = areaTexturePlacement(light);
  set[AREA_LIGHT_TEXTURE_RECTS].set(rect, index * 4);
  set[AREA_LIGHT_TEXTURE_MIPMAPS][index] = maxMipmap;
}

/** Gives the arrays to every built-in lit material. */
export function installAreaLightUniforms(): void {
  arrays.install();
}

/** An area light's local axes: it faces -Z, and its width runs along +X and its height along +Y. */
export const AREA_LIGHT_AXES = {
  facing: new THREE.Vector3(0, 0, -1),
  width: new THREE.Vector3(1, 0, 0),
  height: new THREE.Vector3(0, 1, 0),
} as const;

/** Writes `light`'s `local` axis into `target` as a unit direction in `camera`'s view space. */
export function areaLightViewAxis(
  target: THREE.Vector3,
  local: THREE.Vector3,
  light: THREE.RectAreaLight,
  camera: THREE.Camera
): THREE.Vector3 {
  return target
    .copy(local)
    .transformDirection(light.matrixWorld)
    .transformDirection(camera.matrixWorldInverse);
}

const scratchFacing = new THREE.Vector3();

/**
 * Godot's direction (4.7.2: `light_storage.cpp:1068`), the radius it inverts into `inv_radius`
 * (`:1060-1061`), its `specular_amount` (`:1056`) and its texture's place in the atlas
 * (`:1132-1141`), at `index` of `set`. The direction needs no
 * falloff, so a light without one still faces its own way.
 */
function writeLight(
  set: LightArrays<AreaLightUniform>,
  index: number,
  light: THREE.RectAreaLight,
  camera: THREE.Camera
) {
  const offset = index * 3;
  areaLightViewAxis(scratchFacing, AREA_LIGHT_AXES.facing, light, camera).toArray(
    set[AREA_LIGHT_FACINGS],
    offset
  );
  writeTexture(set, index, light);
  const falloff = readAreaLightFalloff(light);
  if (!falloff) return;
  const falloffs = set[AREA_LIGHT_FALLOFFS];
  falloffs[offset] = Math.max(0.001, falloff.range);
  falloffs[offset + 1] = falloff.attenuation;
  falloffs[offset + 2] = falloff.specular * 2;
}

/**
 * Writes the slotted lights among `lights`, their shadows' terms too, for a render through
 * `camera`. A light without a falloff keeps its slot and its facing, and leaves its falloff entries
 * as they were.
 */
export function writeAreaLightUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedLights(lights, camera).area;
  arrays.write(slotted.length, (set) =>
    slotted.forEach((light, index) => writeLight(set, index, light, camera))
  );
  writeAreaLightShadowUniforms(slotted, camera);
}
