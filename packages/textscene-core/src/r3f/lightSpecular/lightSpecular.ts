/**
 * Each omni, spot and directional light's Godot `specular_amount`, which three's light structs lack,
 * in one uniform array that every lit program reads by the light's slot: directional lights, then
 * sun lights, then point lights, then spot lights. The scene's light pass (`SceneShadowFitter.tsx`)
 * writes it before each render.
 */

import type * as THREE from 'three';
import { declaredLightOf } from '../directionalShadow/splitSun.js';
import { slotValues, type SlottedLights } from '../lightSlots.js';
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
function specularAmountOf(light: THREE.Light): number {
  const declared = declaredLightOf(light);
  return (declared && declaration.read(declared)?.amount) ?? 1;
}

/** Writes the specular amount of each light among `slotted`. */
export function writeLightSpecularUniforms(slotted: SlottedLights): void {
  const ordered = slotValues(slotted, specularAmountOf);
  arrays.write(ordered.length, (set) => set[LIGHT_SPECULARS].set(ordered));
}
