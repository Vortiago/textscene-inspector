/**
 * What a directional light tells the sky. Godot's sky shader and scene shader read a light apart,
 * so a light can draw in one and not the other (`sky_mode`). The light declares its part in the
 * sky on its own `userData`, and `<SkyLayer>` reads it.
 */

import type * as THREE from 'three';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { perObject } from '../../utils/perObject.js';

interface SkyLightDeclaration {
  /** False for a Light Only light, which the sky shader skips (`sky.cpp:1069`). */
  drawsInSky: boolean;
  /**
   * `light_energy`, as the sky reads it (`sky.cpp` sets the sky's energy with no PI). A Sky Only
   * light has zero three intensity, so the sky cannot recover this from the light.
   */
  energy: number;
  /** The sun disc's angular size in radians, Godot's `LIGHTn_SIZE`. */
  size: number;
}

const declaration = userDataDeclaration<SkyLightDeclaration>(
  'skyLight',
  ({ drawsInSky, energy, size }) =>
    typeof drawsInSky === 'boolean' && typeof energy === 'number' && typeof size === 'number'
);

/** The `userData` entry that declares a light's part in the sky, to merge into its `userData`. */
export const skyLightUserData = declaration.userData;

/**
 * The energy the sky reads from `light`, or null for a light the sky skips. A light that declares
 * none, such as a GLB light, goes back through the intensity scale, so its disc reads 1/PI dim.
 */
export function skyLightEnergy(light: THREE.DirectionalLight): number | null {
  const sky = declaration.read(light);
  if (!sky) return light.intensity / LIGHT_INTENSITY_SCALE;
  return sky.drawsInSky ? sky.energy : null;
}

/** The sun disc size the sky reads from `light`. A light that declares none is a point sun. */
export function skyLightSize(light: THREE.DirectionalLight): number {
  return declaration.read(light)?.size ?? 0;
}

/** The light data of a render whose sky reads no lights: Godot gives it a count of 0. */
export const NO_SKY_LIGHTS = '';

/**
 * The sky light data of the last render with a sky on each renderer, which Godot keeps for every sky
 * at once (`sky.cpp:1105-1143`). Written only by `noteSkyLights`.
 */
const lastSkyLightsOf = perObject((_gl: THREE.WebGLRenderer) => ({ lights: NO_SKY_LIGHTS, exposure: 1 }));

/**
 * Notes a render's sky light data, `lights` at `exposure`, which scales each energy. Answers whether
 * it differs from the last render's, which dirties the sky the render draws.
 */
export function noteSkyLights(gl: THREE.WebGLRenderer, lights: string, exposure: number): boolean {
  const last = lastSkyLightsOf(gl);
  if (last.lights === lights && last.exposure === exposure) return false;
  last.lights = lights;
  last.exposure = exposure;
  return true;
}
