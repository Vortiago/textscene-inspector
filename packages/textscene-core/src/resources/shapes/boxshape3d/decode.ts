/**
 * BoxShape3D decode — property bag in, box extents out.
 *
 * `box_shape_3d.cpp:100` ERR_FAILs when ANY component is negative, refusing the
 * whole assignment, so a partly-negative size keeps the `Vector3(1, 1, 1)`
 * default rather than a per-component clamp Godot never stores.
 */

import { warn } from '../../../logger';
import { nonNegativeSizeOr } from '../../../parser/valueParsers';
import { parseVector3 } from '../../../parser/vectors';
import type { BoxShape3DProperties } from './types';

const DEFAULT_SIZE = { x: 1, y: 1, z: 1 };

export function decodeBoxShape3D(properties: Record<string, string>): BoxShape3DProperties {
  let size = DEFAULT_SIZE;
  if (properties.size) {
    try {
      size = nonNegativeSizeOr(parseVector3(properties.size), DEFAULT_SIZE, 'BoxShape3D size');
    } catch (error) {
      warn(`Failed to parse BoxShape3D size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { size };
}
