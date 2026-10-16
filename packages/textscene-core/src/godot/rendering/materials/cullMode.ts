/** The faces a BaseMaterial3D culls. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::CullMode` (`scene/resources/material.h:249-254`), as the integers a `.tscn`
 * stores for `cull_mode`. BACK culls back faces, so it draws the front. The default is BACK
 * (`material.h:605`).
 */
export enum CullMode {
  BACK = 0,
  FRONT = 1,
  DISABLED = 2,
}

/** Each mode's name by the integer a `.tscn` stores, as a validator names it. */
export const CULL_MODE_NAMES = enumNamesByValue(CullMode);
