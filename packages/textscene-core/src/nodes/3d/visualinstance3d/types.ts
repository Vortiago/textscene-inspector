/** VisualInstance3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface VisualInstance3DProperties extends Node3DProperties {
  /** `layers`, the 32-bit render mask a Decal's `cull_mask` and a ReflectionProbe's masks test. */
  layers: number;
}
