/**
 * What a directional light tells the sky. Godot's sky shader and scene shader read a light apart,
 * so a light can draw in one and not the other (`sky_mode`). The light declares its part in the
 * sky on its own `userData`, and `<SkyLayer>` reads it.
 */

import type * as THREE from 'three';

export interface SkyLightDeclaration {
  /** False for a Light Only light, which the sky shader skips (`sky.cpp:1069`). */
  drawsInSky: boolean;
  /**
   * `light_energy`, as the sky reads it (`sky.cpp` sets the sky's energy with no PI). A Sky Only
   * light has zero three intensity, so the sky cannot recover this from the light.
   */
  energy: number;
}

/** The `userData` key. One key, so a light carries one declaration. */
const DECLARATION_KEY = 'skyLight';

/** The `userData` entry that declares `declaration`, to merge into a light's `userData`. */
export function skyLightUserData(declaration: SkyLightDeclaration): Record<string, unknown> {
  return { [DECLARATION_KEY]: declaration };
}

/** The light's declaration, or null for a light that made none, such as a GLB light. */
export function readSkyLightDeclaration(light: THREE.Object3D): SkyLightDeclaration | null {
  const declaration = (light.userData as Record<string, unknown>)[DECLARATION_KEY];
  return isDeclaration(declaration) ? declaration : null;
}

function isDeclaration(value: unknown): value is SkyLightDeclaration {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.drawsInSky === 'boolean' && typeof candidate.energy === 'number';
}
