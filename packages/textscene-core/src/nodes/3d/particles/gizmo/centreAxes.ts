/** The three unit axes that Godot's CPUParticles3D gizmo draws from the centre of its box. */

import { aabbCenter, type Aabb } from '../../../../godot/math/aabb';

/**
 * Three segments of length 1 along +X, +Y and +Z, as flat `xyz` start and end points
 * (`cpu_particles_3d_gizmo_plugin.cpp:87-94`). The length is 1 whatever the size of the box.
 */
export function centreAxisLines(box: Aabb): number[] {
  const { x, y, z } = aabbCenter(box);
  return [x, y, z, x + 1, y, z, x, y, z, x, y + 1, z, x, y, z, x, y, z + 1];
}
