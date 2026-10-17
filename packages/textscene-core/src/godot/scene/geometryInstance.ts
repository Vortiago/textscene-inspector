/** Godot 4.6.3's GeometryInstance3D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `GeometryInstance3D::GIMode` (`scene/3d/visual_instance_3d.h:101-105`). */
const GiMode = {
  DISABLED: 0,
  STATIC: 1,
  DYNAMIC: 2,
} as const;

/** Each GI mode by its integer, spelled as its constant without `GI_MODE_`. */
export const GEOMETRY_INSTANCE_3D_GI_MODE_NAMES = enumNamesByValue(GiMode);
