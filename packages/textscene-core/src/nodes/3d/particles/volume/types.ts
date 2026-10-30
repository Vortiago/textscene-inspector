/**
 * Types of the GPU particles collision and attractor nodes, which Godot draws as a volume: a box
 * of `size`, or a sphere of `radius`, centred on the node.
 */

import type { Vector3 } from '../../../../godot/math/vector';
import type { Node3DProperties } from '../../../base/node3d/types';

export interface BoxVolumeProperties extends Node3DProperties {
  /** The full size of the box in local units. No setter clamps it. */
  size: Vector3;
}

export interface SphereVolumeProperties extends Node3DProperties {
  /** The radius of the sphere in local units. No setter clamps it. */
  radius: number;
}

export interface SdfVolumeProperties extends BoxVolumeProperties {
  /** A `GPUParticlesCollisionSDF3D::Resolution`: which of 16 to 512 cells divide the longest side. */
  resolution: number;
}
