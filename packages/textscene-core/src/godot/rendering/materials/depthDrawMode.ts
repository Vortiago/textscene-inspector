/** When a BaseMaterial3D writes depth. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::DepthDrawMode` (`scene/resources/material.h:236-241`), as the integers a
 * `.tscn` stores for `depth_draw_mode`. OPAQUE_ONLY is the default (`material.h:603`) and writes
 * depth in the opaque pass only: a surface that lands in the alpha pass under it writes none.
 */
export enum DepthDrawMode {
  OPAQUE_ONLY = 0,
  ALWAYS = 1,
  DISABLED = 2,
}

export const DEPTH_DRAW_MODE_NAMES = enumNamesByValue(DepthDrawMode);
