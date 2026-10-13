/**
 * Each light's Godot size, which three's light structs lack, in one uniform array that every lit
 * program reads by the light's slot (`../lightSlots.ts`). An omni or spot light's is its
 * `light_size`, and a directional light's is the cosine offset of its `light_angular_distance`. The
 * light function widens each light's N.L by it (`lightSizeChunk.ts`). The scene's light pass
 * (`SceneShadowFitter.tsx`) writes it before each render.
 */

import type * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { LIGHT_KINDS, slottedLights, type LightKind } from '../lightSlots.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';
import { SplitSunLight } from '../directionalShadow/splitSun.js';
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
 * The light's declared size. A directional light takes its size only while Godot's directional soft
 * shadows are on (`scene_forward_clustered.glsl:2617`), and a split sun takes the size of the light
 * it shades for. A light without a declaration, such as a GLB light, has no size.
 */
function sizeOf(light: THREE.Light, kind: LightKind, drawsDirectionalSoftShadows: boolean): number {
  const isDirectional = kind === 'directional' || kind === 'sun';
  if (isDirectional && !drawsDirectionalSoftShadows) return 0;
  const declared = light instanceof SplitSunLight ? light.parent : light;
  if (!declared) return 0;
  return declaration.read(declared)?.size ?? 0;
}

/**
 * Writes the size of each slotted light among `lights`, for a render through `camera`.
 * `drawsDirectionalSoftShadows` is Godot's flag for the render (`sunSoftShadow.ts`).
 */
export function writeLightSizeUniforms(
  lights: readonly SceneLight[],
  camera: THREE.Camera,
  drawsDirectionalSoftShadows: boolean
): void {
  const slotted = slottedLights(lights, camera);
  const ordered = LIGHT_KINDS.flatMap((kind) =>
    slotted[kind].map((light) => sizeOf(light, kind, drawsDirectionalSoftShadows))
  );
  arrays.write(ordered.length, (set) => set[LIGHT_SIZES].set(ordered));
}
