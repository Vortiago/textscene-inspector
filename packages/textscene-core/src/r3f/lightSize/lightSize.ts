/**
 * Each omni and spot light's Godot `light_size`, which three's light structs lack, in one uniform
 * array that every lit program reads by the light's slot (`../lightSlots.ts`). The light function
 * widens each light's N.L by it (`lightSizeChunk.ts`). The scene's light pass
 * (`SceneShadowFitter.tsx`) writes it before each render.
 */

import type * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { LIGHT_KINDS, slottedLights, type LightKind } from '../lightSlots.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';
import { userDataDeclaration } from '../userDataDeclaration.js';

export const LIGHT_SIZES = 'godotLightSizes';

/** The size a light carries to the writer. */
interface LightSizeDeclaration {
  size: number;
}

const declaration = userDataDeclaration<LightSizeDeclaration>(
  'godotLightSize',
  ({ size }) => typeof size === 'number'
);

/** The `userData` entry that declares a light's size, to merge into its `userData`. */
export function lightSizeUserData(size: number): Record<string, unknown> {
  return declaration.userData({ size });
}

/** One float per light. Written only by `writeLightSizeUniforms`. */
const arrays = new LightUniformArrays({ [LIGHT_SIZES]: 1 });

/** Gives the array to every built-in lit material. */
export function installLightSizeUniforms(): void {
  arrays.install();
}

/**
 * The light's declared size. A directional light's `light_angular_distance` is not drawn, and a
 * light without a declaration, such as a GLB light, has no size.
 */
function sizeOf(light: THREE.Light, kind: LightKind): number {
  if (kind !== 'point' && kind !== 'spot') return 0;
  return declaration.read(light)?.size ?? 0;
}

/** Writes the size of each slotted light among `lights`, for a render through `camera`. */
export function writeLightSizeUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedLights(lights, camera);
  const ordered = LIGHT_KINDS.flatMap((kind) => slotted[kind].map((light) => sizeOf(light, kind)));
  arrays.write(ordered.length, (set) => set[LIGHT_SIZES].set(ordered));
}
