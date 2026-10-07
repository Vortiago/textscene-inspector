/** The GeometryInstance3D properties every drawn leaf reads. */

import { ShadowCastingSetting } from '../../../godot/rendering';
import type { Node3DProperties } from '../../base/node3d/types';

export interface GeometryInstance3DProperties extends Node3DProperties {
  /** `transparency`: 0 is opaque, and 1 is fully transparent. */
  transparency: number;
  /** `cast_shadow`, a `ShadowCastingSetting`. */
  castShadow: number;
}

/** Godot's defaults (`visual_instance_3d.h:122,132`), which a scene that sets no value keeps. */
export const GEOMETRY_INSTANCE_DEFAULTS: Readonly<
  Pick<GeometryInstance3DProperties, 'transparency' | 'castShadow'>
> = Object.freeze({
  transparency: 0,
  castShadow: ShadowCastingSetting.ON,
});
