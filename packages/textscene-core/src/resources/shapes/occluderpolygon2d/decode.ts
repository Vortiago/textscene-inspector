/**
 * The OccluderPolygon2D kind (`light_occluder_2d.cpp`): the polygon a LightOccluder2D draws and
 * casts shadows from, with its closure and cull mode. A polygon that is absent or unreadable
 * declines the resource, as a LightOccluder2D with no polygon draws and casts nothing.
 */

import { warn } from '../../../logger';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import type { ResourceKind } from '../../reading';
import { parsePackedVector2Array } from '../packedArray';
import { parseOccluderCullMode } from './cullMode';
import type { OccluderPolygon2DData } from './types';

export const OCCLUDER_POLYGON_2D: ResourceKind<OccluderPolygon2DData> = {
  name: 'OccluderPolygon2D',
  accepts: (type) => type === 'OccluderPolygon2D',
  decode: (held) => {
    const literal = held.properties.polygon;
    if (!literal) return null;
    try {
      return {
        polygon: parsePackedVector2Array(literal),
        isClosed: boolSlotValue(held.properties.closed) !== false,
        cullMode: parseOccluderCullMode(held.properties.cull_mode),
      };
    } catch {
      // The linter reports a malformed literal. Rendering must not throw through it.
      warn(`[LightOccluder2D] unreadable occluder polygon: ${literal}`);
      return null;
    }
  },
};
