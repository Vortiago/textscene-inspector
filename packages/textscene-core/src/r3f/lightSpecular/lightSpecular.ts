/**
 * Each omni, spot and directional light's Godot `specular_amount`, which three's light structs lack,
 * in one uniform array that every lit program reads by the light's slot: directional lights, then
 * sun lights, then point lights, then spot lights. The scene's light pass (`SceneShadowFitter.tsx`)
 * writes it before each render.
 */

import type * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { LIGHT_KINDS, slottedLights, type LightKind } from '../lightSlots.js';
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

/**
 * The light's declared amount. A sun shades for the directional light it hangs under
 * (`directionalShadow/splitSun.ts`), so it takes that light's. A light without one, such as a GLB
 * light, keeps three's full specular.
 */
function specularAmountOf(light: THREE.Light, kind: LightKind): number {
  const declarer = kind === 'sun' ? light.parent : light;
  return (declarer && declaration.read(declarer)?.amount) ?? 1;
}

/** Writes the specular amount of each slotted light among `lights`, for a render through `camera`. */
export function writeLightSpecularUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedLights(lights, camera);
  const ordered = LIGHT_KINDS.flatMap((kind) => slotted[kind].map((light) => specularAmountOf(light, kind)));
  arrays.write(ordered.length, (set) => set[LIGHT_SPECULARS].set(ordered));
}
