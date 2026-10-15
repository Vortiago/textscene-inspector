/** The SpriteBase3D properties that place its quad, which every SpriteBase3D type parses alike. */

import { boolOr, enumOr, floatOr, vec2Or } from '../../../parser/valueParsers';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import { type Sprite3DProperties } from './types';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';

/** What places the quad. */
export type SpriteQuadProperties = Pick<
  Sprite3DProperties,
  'billboard' | 'axis' | 'pixel_size' | 'offset' | 'centered'
>;

export function parseSpriteQuad(properties: Record<string, string>, context: string): SpriteQuadProperties {
  return {
    // The setter refuses an index outside 0-2, PARTICLES included (`sprite_3d.cpp:598`), so the
    // sprite keeps its DISABLED default.
    billboard: enumOr(properties.billboard, BillboardMode.BILLBOARD_DISABLED, [
      BillboardMode.BILLBOARD_DISABLED,
      BillboardMode.BILLBOARD_ENABLED,
      BillboardMode.BILLBOARD_FIXED_Y,
    ]),
    axis: enumOr(properties.axis, Vector3Axis.Z, [Vector3Axis.X, Vector3Axis.Y, Vector3Axis.Z]),
    pixel_size: floatOr(properties.pixel_size, 0.01),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, context),
    centered: boolOr(properties.centered, true),
  };
}
