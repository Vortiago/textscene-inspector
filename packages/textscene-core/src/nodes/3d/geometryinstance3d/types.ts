/** The GeometryInstance3D properties every drawn leaf reads. */

import { ShadowCastingSetting } from '../../../godot/rendering';
import { NO_VISIBILITY_RANGE, type VisibilityRange } from '../../../godot/visibilityRange';
import type { AabbValue } from '../../../parser/valueParsers';
import type { Node3DProperties } from '../../base/node3d/types';

export interface GeometryInstance3DProperties extends Node3DProperties {
  /** `transparency`: 0 is opaque, and 1 is fully transparent. */
  transparency: number;
  /** `cast_shadow`, a `ShadowCastingSetting`. */
  castShadow: number;
  /** The `visibility_range_*` group: the camera distances the instance draws at. */
  visibilityRange: VisibilityRange;
  /** `custom_aabb`, which replaces a mesh's own box. Null for none, which an all-zero box also means. */
  customAabb: AabbValue | null;
}

/** Godot's defaults (`visual_instance_3d.h:122-140`), which a scene that sets no value keeps. */
export const GEOMETRY_INSTANCE_DEFAULTS: Readonly<
  Pick<GeometryInstance3DProperties, 'transparency' | 'castShadow' | 'visibilityRange' | 'customAabb'>
> = Object.freeze({
  transparency: 0,
  castShadow: ShadowCastingSetting.ON,
  visibilityRange: NO_VISIBILITY_RANGE,
  customAabb: null,
});
