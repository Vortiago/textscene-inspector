/**
 * FogVolume types. Godot's FogVolume is a VisualInstance3D that adds its material's fog to the
 * Environment's volumetric fog inside an origin-centred shape of `size`.
 */

import type { FogVolumeShape } from '../../../godot/rendering/environment/fogVolume';
import type { Node3DProperties } from '../../base/node3d/types';
import type { Vector3 } from '../../../godot/math/vector';

export interface FogVolumeProperties extends Node3DProperties {
  /** The full size of the shape in local units. The WORLD shape ignores it. */
  size: Vector3;
  /** A `FogVolumeShape`, or a value outside it, which Godot stores and draws as no shape. */
  shape: FogVolumeShape | number;
  /** The FogMaterial or ShaderMaterial reference as written, if any. */
  material?: string;
}
