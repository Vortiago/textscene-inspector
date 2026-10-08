/** The SpriteBase3D properties that place its quad, which every SpriteBase3D type parses alike. */

import { boolOr, enumOr, floatOr, vec2Or } from '../../../parser/valueParsers';
import { AxisMode, BillboardMode, type Sprite3DProperties } from './types';

/** What places the quad. */
export type SpriteQuadProperties = Pick<
  Sprite3DProperties,
  'billboard' | 'axis' | 'pixel_size' | 'offset' | 'centered'
>;

export function parseSpriteQuad(properties: Record<string, string>, context: string): SpriteQuadProperties {
  return {
    billboard: enumOr(properties.billboard, BillboardMode.BILLBOARD_DISABLED, [
      BillboardMode.BILLBOARD_DISABLED,
      BillboardMode.BILLBOARD_ENABLED,
      BillboardMode.BILLBOARD_FIXED_Y,
      BillboardMode.BILLBOARD_PARTICLES,
    ]),
    axis: enumOr(properties.axis, AxisMode.AXIS_Z, [AxisMode.AXIS_X, AxisMode.AXIS_Y, AxisMode.AXIS_Z]),
    pixel_size: floatOr(properties.pixel_size, 0.01),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, context),
    centered: boolOr(properties.centered, true),
  };
}
