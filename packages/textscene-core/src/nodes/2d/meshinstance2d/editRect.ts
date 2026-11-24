import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Aabb } from '../../../godot/math/aabb.js';

/** mesh_instance_2d.cpp:107-118: the mesh box seen down its z axis. Null is no mesh. */
export function meshInstance2DEditRect(aabb: Aabb | null): Rect2 | null {
  return aabb && { x: aabb.position.x, y: aabb.position.y, w: aabb.size.x, h: aabb.size.y };
}
