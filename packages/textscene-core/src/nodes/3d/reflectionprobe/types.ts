/**
 * ReflectionProbe types. Godot's ReflectionProbe captures the scene around it into a cube and
 * hands it to the surfaces inside its box as their reflections and, by its ambient mode, their
 * ambient light.
 */

import type { ReflectionProbeAmbientMode, ReflectionProbeUpdateMode } from '../../../godot/reflectionProbe';
import type { Vector3 } from '../../../godot/vector';
import type { Node3DProperties } from '../../base/node3d/types';
import type { Rgba } from '../../../godot/math';

export interface ReflectionProbeProperties extends Node3DProperties {
  updateMode: ReflectionProbeUpdateMode;
  intensity: number;
  blendDistance: number;
  maxDistance: number;
  /** The full size of the box in local units. */
  size: Vector3;
  /** The capture's origin in the box, as Godot holds it after its setters clamp it. */
  originOffset: Vector3;
  boxProjection: boolean;
  interior: boolean;
  enableShadows: boolean;
  /** The layers the capture draws. */
  cullMask: number;
  /** The layers whose surfaces read the probe. */
  reflectionMask: number;
  ambientMode: ReflectionProbeAmbientMode;
  /** As written, in sRGB. */
  ambientColor: Rgba;
  ambientColorEnergy: number;
}
