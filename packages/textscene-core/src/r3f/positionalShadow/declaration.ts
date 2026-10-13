/**
 * What a positional light tells the scene's positional shadow fitter: its Godot shadow parameters
 * that depend on the slot the atlas gives it. The fitter owns the map size, the kernel and the
 * normal bias, as Godot's atlas owns the slot.
 */

import { userDataDeclaration } from '../userDataDeclaration.js';

export interface PositionalShadowDeclaration {
  /** `shadow_normal_bias`, in ten texels of the light's slot. */
  normalBias: number;
  /** The PCF kernel's radius, or minus the penumbra's spread (`softShadowRadius.ts`). */
  softShadowRadius: number;
}

const declaration = userDataDeclaration<PositionalShadowDeclaration>(
  'positionalShadow',
  ({ normalBias, softShadowRadius }) => typeof normalBias === 'number' && typeof softShadowRadius === 'number'
);

/** The `userData` entry that declares a light's shadow, to merge into the light's `userData`. */
export const positionalShadowUserData = declaration.userData;

/** The light's declaration, or null for a light that made none, which the fitter leaves alone. */
export const readPositionalShadowDeclaration = declaration.read;
