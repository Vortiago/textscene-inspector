/**
 * What an omni or spot light tells the scene's positional shadow fitter: its Godot shadow parameters
 * that depend on the slot the atlas gives it. The fitter owns the map size, the kernel and the
 * normal bias, as Godot's atlas owns the slot.
 */

import { userDataDeclaration } from '../userDataDeclaration.js';

export interface PositionalShadowDeclaration {
  /** `shadow_normal_bias`, in ten texels of the light's slot. */
  normalBias: number;
  /** The PCF kernel's radius in atlas texels: Godot's `soft_shadow_scale`. */
  softShadowScale: number;
}

const declaration = userDataDeclaration<PositionalShadowDeclaration>(
  'positionalShadow',
  ({ normalBias, softShadowScale }) => typeof normalBias === 'number' && typeof softShadowScale === 'number'
);

/** The `userData` entry that declares a light's shadow, to merge into the light's `userData`. */
export const positionalShadowUserData = declaration.userData;

/** The light's declaration, or null for a light that made none, which the fitter leaves alone. */
export const readPositionalShadowDeclaration = declaration.read;
