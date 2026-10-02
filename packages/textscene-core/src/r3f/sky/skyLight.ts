/**
 * What a directional light tells the sky. Godot's sky shader and scene shader read a light apart,
 * so a light can draw in one and not the other (`sky_mode`). The light declares its part in the
 * sky on its own `userData`, and `<SkyLayer>` reads it.
 */

import { userDataDeclaration } from '../userDataDeclaration.js';

export interface SkyLightDeclaration {
  /** False for a Light Only light, which the sky shader skips (`sky.cpp:1069`). */
  drawsInSky: boolean;
  /**
   * `light_energy`, as the sky reads it (`sky.cpp` sets the sky's energy with no PI). A Sky Only
   * light has zero three intensity, so the sky cannot recover this from the light.
   */
  energy: number;
}

const declaration = userDataDeclaration<SkyLightDeclaration>(
  'skyLight',
  ({ drawsInSky, energy }) => typeof drawsInSky === 'boolean' && typeof energy === 'number'
);

/** The `userData` entry that declares a light's part in the sky, to merge into its `userData`. */
export const skyLightUserData = declaration.userData;

/** The light's declaration, or null for a light that made none, such as a GLB light. */
export const readSkyLightDeclaration = declaration.read;
