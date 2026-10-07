/** The GeometryInstance3D properties every drawn leaf reads. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface GeometryInstance3DProperties extends Node3DProperties {
  /** `transparency`: 0, the default, is opaque, and 1 is fully transparent. */
  transparency?: number;
  /** `cast_shadow`: a `ShadowCastingSetting`, ON (1) by default. */
  castShadow?: number;
}
