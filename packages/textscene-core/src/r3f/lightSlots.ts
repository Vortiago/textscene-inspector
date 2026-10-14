/**
 * The slots three's `WebGLLights` gives the lights `RE_Direct` shades, which a uniform array of
 * Godot terms reads by: directional lights, then sun lights, then point lights, then spot lights.
 */

import type * as THREE from 'three';
import type { SceneLight } from './directionalShadow/lightLists.js';

/** The kinds `RE_Direct` shades, in the order the array holds them. */
const LIGHT_KINDS = ['directional', 'sun', 'point', 'spot'] as const;
export type LightKind = (typeof LIGHT_KINDS)[number];

/** The lights `RE_Direct` shades, as GLSL: the length of an array read by slot. */
const SHADED_LIGHTS = 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS';

/**
 * Each kind's loop in `lights_fragment_begin`: the line that picks its light, the light, and the
 * light's slot as GLSL. three unrolls `[ i ]` alone, so a slot past the kind's first reads
 * `UNROLLED_LOOP_INDEX`.
 */
export const LIGHT_SLOT_LOOPS = [
  {
    three: 'directionalLight = directionalLights[ i ];',
    light: 'directionalLight',
    slot: 'UNROLLED_LOOP_INDEX',
  },
  { three: 'sunLight = sunLights[ i ];', light: 'sunLight', slot: 'NUM_DIR_LIGHTS + UNROLLED_LOOP_INDEX' },
  {
    three: 'pointLight = pointLights[ i ];',
    light: 'pointLight',
    slot: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + UNROLLED_LOOP_INDEX',
  },
  {
    three: 'spotLight = spotLights[ i ];',
    light: 'spotLight',
    slot: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + UNROLLED_LOOP_INDEX',
  },
] as const;

/** The line of `lights_pars_begin` a patch declares its slot array before. */
export const LIGHTS_PARS_ANCHOR = 'uniform vec3 ambientLightColor;';

/** A uniform array `name` of one float per slot. A program with no shaded light declares none. */
export function slotArrayDeclaration(name: string): string {
  return `#if ${SHADED_LIGHTS} > 0\n\tuniform float ${name}[ ${SHADED_LIGHTS} ];\n#endif\n`;
}

/** The kind three's `WebGLLights` files the light under, which tests a sun before a directional light. */
function kindOf(light: THREE.Light): LightKind | null {
  const flags = light as THREE.Light & {
    isSunLight?: boolean;
    isDirectionalLight?: boolean;
    isPointLight?: boolean;
    isSpotLight?: boolean;
  };
  if (flags.isSunLight) return 'sun';
  if (flags.isDirectionalLight) return 'directional';
  if (flags.isSpotLight) return 'spot';
  if (flags.isPointLight) return 'point';
  return null;
}

/** three's own sort: shadowed lights first, then lights with a map (r186 `WebGLLights.js:152-156`). */
function shadowedAndTexturedFirst(a: THREE.Light, b: THREE.Light): number {
  const rank = (light: THREE.Light) => (light.castShadow ? 2 : 0) + ((light as THREE.SpotLight).map ? 1 : 0);
  return rank(b) - rank(a);
}

/**
 * The lights three gives a slot when it renders through `camera`, in slot order: visible, on a
 * layer the camera sees, in tree order (r186 `WebGLRenderer.js:1860-1882`), then through three's
 * stable sort (`WebGLLights.js:245`).
 */
export function renderedLights(lights: readonly SceneLight[], camera: THREE.Camera): THREE.Light[] {
  return lights
    .filter(({ light, isVisible }) => isVisible && light.layers.test(camera.layers))
    .map(({ light }) => light)
    .sort(shadowedAndTexturedFirst);
}

/** The lights `RE_Direct` shades through `camera`, by kind, each in slot order. */
export function slottedLights(
  lights: readonly SceneLight[],
  camera: THREE.Camera
): Record<LightKind, THREE.Light[]> {
  const slotted: Record<LightKind, THREE.Light[]> = { directional: [], sun: [], point: [], spot: [] };
  for (const light of renderedLights(lights, camera)) {
    const kind = kindOf(light);
    if (kind) slotted[kind].push(light);
  }
  return slotted;
}

/** `valueOf` each light three gives a slot when it renders through `camera`, in slot order. */
export function slotValues(
  lights: readonly SceneLight[],
  camera: THREE.Camera,
  valueOf: (light: THREE.Light, kind: LightKind) => number
): number[] {
  const slotted = slottedLights(lights, camera);
  return LIGHT_KINDS.flatMap((kind) => slotted[kind].map((light) => valueOf(light, kind)));
}
