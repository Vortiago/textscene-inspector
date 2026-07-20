/** CapsuleShape3D collision-shape resource parser. */

import { floatOr } from '../../../parser/valueParsers';

export interface CapsuleShape3DProperties {
  /** Capsule radius. class_capsuleshape3d.html: default 0.5. */
  radius: number;
  /**
   * FULL height along the local Y axis, hemispheres included.
   * class_capsuleshape3d.html: default 2.0, and "the height of a capsule must
   * be at least twice its radius. Otherwise, the capsule becomes a sphere."
   */
  height: number;
}

export function parseCapsuleShape3D(
  properties: Record<string, string>
): CapsuleShape3DProperties {
  const radius = floatOr(properties.radius, 0.5, 'CapsuleShape3D');
  const height = floatOr(properties.height, 2, 'CapsuleShape3D');
  // Godot clamps a too-short capsule up to a sphere rather than inverting it.
  return { radius, height: Math.max(height, radius * 2) };
}
