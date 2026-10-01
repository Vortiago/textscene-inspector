/**
 * What an omni or spot light tells the scene's positional shadow fitter: its Godot shadow parameters
 * that depend on the slot the atlas gives it. The fitter owns the map size, the kernel and the
 * normal bias, as Godot's atlas owns the slot.
 */

import type * as THREE from 'three';

export interface PositionalShadowDeclaration {
  /** `shadow_normal_bias`, in ten texels of the light's slot. */
  normalBias: number;
  /** The PCF kernel's radius in atlas texels: Godot's `soft_shadow_scale`. */
  softShadowScale: number;
}

/** The `userData` key. One key, so a light carries one declaration. */
const DECLARATION_KEY = 'positionalShadow';

/** The `userData` entry that declares `declaration`. R3F assigns a `userData` prop whole. */
export function positionalShadowUserData(declaration: PositionalShadowDeclaration): Record<string, unknown> {
  return { [DECLARATION_KEY]: declaration };
}

/** The light's declaration, or null for a light that made none, which the fitter leaves alone. */
export function readPositionalShadowDeclaration(light: THREE.Object3D): PositionalShadowDeclaration | null {
  const declaration = (light.userData as Record<string, unknown>)[DECLARATION_KEY];
  return isDeclaration(declaration) ? declaration : null;
}

function isDeclaration(value: unknown): value is PositionalShadowDeclaration {
  if (typeof value !== 'object' || value === null) return false;
  const { normalBias, softShadowScale } = value as Record<string, unknown>;
  return typeof normalBias === 'number' && typeof softShadowScale === 'number';
}
