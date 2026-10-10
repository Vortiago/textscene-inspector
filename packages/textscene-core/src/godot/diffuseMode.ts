/** The direct diffuse term a BaseMaterial3D's light function writes. */

import { enumNamesByValue } from './enumNames.js';

/**
 * `BaseMaterial3D::DiffuseMode` (`scene/resources/material.h:285-291`), as the integers a `.tscn`
 * stores for `diffuse_mode`. The default is Burley (`material.h:608`).
 */
export enum DiffuseMode {
  DIFFUSE_BURLEY = 0,
  DIFFUSE_LAMBERT = 1,
  DIFFUSE_LAMBERT_WRAP = 2,
  DIFFUSE_TOON = 3,
}

/** Each mode's name by the integer a `.tscn` stores, as a validator names it. */
export const DIFFUSE_MODE_NAMES = enumNamesByValue(DiffuseMode);
