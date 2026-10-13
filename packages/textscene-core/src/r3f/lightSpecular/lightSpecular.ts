/**
 * Each omni, spot and directional light's Godot `specular_amount`, which three's light structs lack,
 * in one uniform array that every lit program reads by the light's slot: directional lights, then
 * sun lights, then point lights, then spot lights. The scene's light pass (`SceneShadowFitter.tsx`)
 * writes it before each render.
 */

import type * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';
import { userDataDeclaration } from '../userDataDeclaration.js';

export const LIGHT_SPECULARS = 'godotLightSpeculars';

/** The specular amount a light carries to the writer. */
interface LightSpecularDeclaration {
  amount: number;
}

const declaration = userDataDeclaration<LightSpecularDeclaration>(
  'godotLightSpecular',
  ({ amount }) => typeof amount === 'number'
);

/** The `userData` entry that declares a light's specular amount, to merge into its `userData`. */
export function lightSpecularUserData(amount: number): Record<string, unknown> {
  return declaration.userData({ amount });
}

/** One float per light. Written only by `writeLightSpecularUniforms`. */
const arrays = new LightUniformArrays({ [LIGHT_SPECULARS]: 1 });

/** Gives the array to every built-in lit material. */
export function installLightSpecularUniforms(): void {
  arrays.install();
}

/** The kinds `RE_Direct` shades, in the order the array holds them. */
const KINDS = ['directional', 'sun', 'point', 'spot'] as const;
type Kind = (typeof KINDS)[number];

/** The kind three's `WebGLLights` files the light under, which tests a sun before a directional light. */
function kindOf(light: THREE.Light): Kind | null {
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
 * The lights three gives a slot when it renders through `camera`, by kind, each in slot order:
 * visible, on a layer the camera sees, in tree order (r186 `WebGLRenderer.js:1860-1882`), then
 * through three's stable sort (`WebGLLights.js:245`).
 */
function slottedLights(lights: readonly SceneLight[], camera: THREE.Camera): Record<Kind, THREE.Light[]> {
  const slotted: Record<Kind, THREE.Light[]> = { directional: [], sun: [], point: [], spot: [] };
  const rendered = lights
    .filter(({ light, isVisible }) => isVisible && light.layers.test(camera.layers))
    .map(({ light }) => light)
    .sort(shadowedAndTexturedFirst);
  for (const light of rendered) {
    const kind = kindOf(light);
    if (kind) slotted[kind].push(light);
  }
  return slotted;
}

/**
 * The light's declared amount. A sun shades for the directional light it hangs under
 * (`directionalShadow/splitSun.ts`), so it takes that light's. A light without one, such as a GLB
 * light, keeps three's full specular.
 */
function specularAmountOf(light: THREE.Light, kind: Kind): number {
  const declarer = kind === 'sun' ? light.parent : light;
  return (declarer && declaration.read(declarer)?.amount) ?? 1;
}

/** Writes the specular amount of each slotted light among `lights`, for a render through `camera`. */
export function writeLightSpecularUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedLights(lights, camera);
  const ordered = KINDS.flatMap((kind) => slotted[kind].map((light) => specularAmountOf(light, kind)));
  arrays.write(ordered.length, (set) => set[LIGHT_SPECULARS].set(ordered));
}
