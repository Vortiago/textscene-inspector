import type { Transform3D } from '../nodes/base/node3d/types';

/** A fresh identity `Transform3D`, the value `Transform3D()` constructs in Godot. */
export function identityTransform3D(): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}
