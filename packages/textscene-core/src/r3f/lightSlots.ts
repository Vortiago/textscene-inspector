/**
 * The slots three's `WebGLLights` gives each light. A uniform array of Godot terms reads the lights
 * `RE_Direct` shades by slot: directional lights, then sun lights, then point lights, then spot
 * lights. Rect area lights have slots of their own.
 */

import type * as THREE from 'three';
import type { SceneLight } from './directionalShadow/lightLists.js';

/**
 * Each kind `RE_Direct` shades, in the order the slot array holds them: three's define that counts
 * its lights, and its loop in `lights_fragment_begin`, the line that picks its light and the light.
 */
const SHADED_KINDS = [
  { kind: 'directional', count: 'NUM_DIR_LIGHTS', light: 'directionalLight', array: 'directionalLights' },
  { kind: 'sun', count: 'NUM_SUN_LIGHTS', light: 'sunLight', array: 'sunLights' },
  { kind: 'point', count: 'NUM_POINT_LIGHTS', light: 'pointLight', array: 'pointLights' },
  { kind: 'spot', count: 'NUM_SPOT_LIGHTS', light: 'spotLight', array: 'spotLights' },
] as const;
export type ShadedLightKind = (typeof SHADED_KINDS)[number]['kind'];

/** The lights three gives a slot, by kind, each in slot order. */
type SlottedLights = Record<ShadedLightKind, THREE.Light[]> & { area: THREE.RectAreaLight[] };

/** The lights `RE_Direct` shades, as GLSL: the length of an array read by slot. */
const SHADED_LIGHTS = SHADED_KINDS.map(({ count }) => count).join(' + ');

/** Whether the kind's light has a position, which an effect that grows near the light reads. */
export function isPositionalKind(kind: ShadedLightKind): boolean {
  return kind === 'point' || kind === 'spot';
}

/**
 * Each kind's loop in `lights_fragment_begin`: the line that picks its light, the light, and the
 * light's slot as GLSL. three unrolls `[ i ]` alone, so a slot reads `UNROLLED_LOOP_INDEX` after
 * the counts of the kinds before it.
 */
export const LIGHT_SLOT_LOOPS = SHADED_KINDS.map(({ kind, light, array }, index) => ({
  kind,
  three: `${light} = ${array}[ i ];`,
  light,
  slot: [...SHADED_KINDS.slice(0, index).map(({ count }) => count), 'UNROLLED_LOOP_INDEX'].join(' + '),
}));

/** The line of `lights_pars_begin` a patch declares its slot array before. */
export const LIGHTS_PARS_ANCHOR = 'uniform vec3 ambientLightColor;';

/** A uniform array `name` of one float per slot. A program with no shaded light declares none. */
export function slotArrayDeclaration(name: string): string {
  return `#if ${SHADED_LIGHTS} > 0\n\tuniform float ${name}[ ${SHADED_LIGHTS} ];\n#endif\n`;
}

function isRectAreaLight(light: THREE.Light): light is THREE.RectAreaLight {
  return (light as THREE.RectAreaLight).isRectAreaLight === true;
}

/** The kind three's `WebGLLights` files the light under, which tests a sun before a directional light. */
function shadedKindOf(light: THREE.Light): ShadedLightKind | null {
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
function renderedLights(lights: readonly SceneLight[], camera: THREE.Camera): THREE.Light[] {
  return lights
    .filter(({ light, isVisible }) => isVisible && light.layers.test(camera.layers))
    .map(({ light }) => light)
    .sort(shadowedAndTexturedFirst);
}

/** The lights three gives a slot when it renders through `camera`, by kind, each in slot order. */
export function slottedLights(lights: readonly SceneLight[], camera: THREE.Camera): SlottedLights {
  const slotted: SlottedLights = { directional: [], sun: [], point: [], spot: [], area: [] };
  for (const light of renderedLights(lights, camera)) {
    if (isRectAreaLight(light)) {
      slotted.area.push(light);
      continue;
    }
    const kind = shadedKindOf(light);
    if (kind) slotted[kind].push(light);
  }
  return slotted;
}

/** `valueOf` each light `RE_Direct` shades among `slotted`, in slot order. */
export function slotValues(
  slotted: SlottedLights,
  valueOf: (light: THREE.Light, kind: ShadedLightKind) => number
): number[] {
  return SHADED_KINDS.flatMap(({ kind }) => slotted[kind].map((light) => valueOf(light, kind)));
}
