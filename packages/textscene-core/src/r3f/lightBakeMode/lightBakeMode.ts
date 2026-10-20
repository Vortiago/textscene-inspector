/**
 * Whether each light is baked Static, which three's light structs lack, in uniform arrays that every
 * lit program reads by the light's slot: one for the lights `RE_Direct` shades, and one for the rect
 * area lights. A lightmapped surface skips a Static light, whose light its lightmap already holds
 * (`scene_forward_clustered.glsl:2292`, `:2685`, `:2746`; 4.7.2 `:2853` for an area light). The
 * scene's light pass (`SceneShadowFitter.tsx`) writes them before each render.
 */

import type * as THREE from 'three';
import { BakeMode } from '../../godot/scene/light.js';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { declaredLightOf } from '../directionalShadow/splitSun.js';
import { slottedLights, slotValues } from '../lightSlots.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';
import { userDataDeclaration } from '../userDataDeclaration.js';

export const LIGHT_STATICS = 'godotLightStatics';
export const AREA_LIGHT_STATICS = 'godotAreaLightStatics';

/** The bake mode a light carries to the writer. */
interface LightBakeModeDeclaration {
  bakeMode: number;
}

const declaration = userDataDeclaration<LightBakeModeDeclaration>(
  'godotLightBakeMode',
  ({ bakeMode }) => typeof bakeMode === 'number'
);

/** The `userData` entry that declares a light's `light_bake_mode`, to merge into its `userData`. */
export function lightBakeModeUserData(bakeMode: number): Record<string, unknown> {
  return declaration.userData({ bakeMode });
}

/** One flag per light, 1 for Static. Written only by `writeLightBakeModeUniforms`. */
const shadedArrays = new LightUniformArrays({ [LIGHT_STATICS]: 1 });
const areaArrays = new LightUniformArrays({ [AREA_LIGHT_STATICS]: 1 });

/** Gives the arrays to every built-in lit material. */
export function installLightBakeModeUniforms(): void {
  shadedArrays.install();
  areaArrays.install();
}

/**
 * 1 for a light declared Static. A sun shades for the directional light it hangs under
 * (`directionalShadow/splitSun.ts`), so it takes that light's mode. A light without one, such as a
 * GLB light, is no Godot light a bake saw.
 */
function staticFlagOf(light: THREE.Light): number {
  const declared = declaredLightOf(light);
  return declared && declaration.read(declared)?.bakeMode === BakeMode.STATIC ? 1 : 0;
}

/** Writes the flag of each slotted light among `lights`, for a render through `camera`. */
export function writeLightBakeModeUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const shaded = slotValues(lights, camera, staticFlagOf);
  shadedArrays.write(shaded.length, (set) => set[LIGHT_STATICS].set(shaded));
  const area = slottedLights(lights, camera).area.map(staticFlagOf);
  areaArrays.write(area.length, (set) => set[AREA_LIGHT_STATICS].set(area));
}
