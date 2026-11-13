/**
 * What a Godot light declares on its `userData` that three's light lacks, for every reader of it:
 * the classic light uniforms and the light nodes.
 */

import { userDataDeclaration } from './userDataDeclaration.js';

/** Godot's `light_specular`. */
export const lightSpecularDeclaration = userDataDeclaration<{ amount: number }>(
  'godotLightSpecular',
  ({ amount }) => typeof amount === 'number'
);

/**
 * A light's Godot size: an omni or spot light's `light_size`, and a directional light's cosine
 * offset of its `light_angular_distance`.
 */
export const lightSizeDeclaration = userDataDeclaration<{ size: number }>(
  'godotLightSize',
  ({ size }) => typeof size === 'number'
);
