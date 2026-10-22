/**
 * RibbonTrailMesh decode. Defaults: `primitive_meshes.h:477-482`. `set_sections`
 * (`primitive_meshes.cpp:2814`) and `set_section_segments` (:2837) ERR_FAIL outside 2 to 128 and
 * 1 to 1024, and keep the default. `set_size` (:2800) ignores a value `is_equal_approx` to the one
 * it holds. `set_shape` (:2788) stores any int, and only Cross builds a cross.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { RibbonTrailMeshShape } from '../../../godot/scene/ribbonTrailMesh.js';
import { intOr, settableIntOr } from '../../../parser/valueParsers';
import { approxDefaultFloatOr, decodeTrailMeshBase } from '../primitivemesh/trailDecode';
import type { RibbonTrailMeshProperties } from './types';

const DEFAULT_SIZE = 1;

/** `curve` is the resource the mesh's `curve` property names, or null when it names none. */
export function decodeRibbonTrailMesh(
  properties: Record<string, string>,
  curve: TscnInternalResource | null
): RibbonTrailMeshProperties {
  return {
    ...decodeTrailMeshBase(properties, curve, 'RibbonTrailMesh'),
    isCross:
      intOr(properties.shape, RibbonTrailMeshShape.CROSS, 'RibbonTrailMesh shape') ===
      RibbonTrailMeshShape.CROSS,
    size: approxDefaultFloatOr(properties.size, DEFAULT_SIZE, 'RibbonTrailMesh size'),
    sectionSegments: settableIntOr(
      properties.section_segments,
      3,
      { min: 1, max: 1024 },
      'RibbonTrailMesh section_segments'
    ),
  };
}
