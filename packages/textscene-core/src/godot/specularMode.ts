/** The direct specular term a BaseMaterial3D's light function writes. */

import { enumNamesByValue } from './enumNames.js';

/**
 * `BaseMaterial3D::SpecularMode` (`scene/resources/material.h:293-298`), as the integers a `.tscn`
 * stores for `specular_mode`.
 */
export enum SpecularMode {
  SPECULAR_SCHLICK_GGX = 0,
  SPECULAR_TOON = 1,
  SPECULAR_DISABLED = 2,
}

/** Each mode's name by the integer a `.tscn` stores, as a validator names it. */
export const SPECULAR_MODE_NAMES = enumNamesByValue(SpecularMode);
