/** Godot 4.6.3's CollisionPolygon2D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `CollisionPolygon2D::BuildMode` (`scene/2d/physics/collision_polygon_2d.h:41-44`). */
const BuildMode = {
  BUILD_SOLIDS: 0,
  BUILD_SEGMENTS: 1,
} as const;

/** Each build mode by its integer, spelled as its full constant (`collision_polygon_2d.cpp:308`). */
export const COLLISION_POLYGON_2D_BUILD_MODE_NAMES = enumNamesByValue(BuildMode);
