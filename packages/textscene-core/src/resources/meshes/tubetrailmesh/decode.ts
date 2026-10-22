/**
 * TubeTrailMesh decode. Defaults: `primitive_meshes.h:420-428`. `set_radial_steps`
 * (`primitive_meshes.cpp:2402`), `set_sections` (:2414) and `set_section_rings` (:2437) ERR_FAIL
 * outside 3 to 128, 2 to 128 and 1 to 1024, and keep the default. `set_radius` (:2388) ignores a
 * value `is_equal_approx` to the one it holds.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { settableIntOr } from '../../../parser/valueParsers';
import { approxDefaultFloatOr, decodeTrailMeshBase } from '../primitivemesh/trailDecode';
import type { TubeTrailMeshProperties } from './types';

const DEFAULT_RADIUS = 0.5;

/** `curve` is the resource the mesh's `curve` property names, or null when it names none. */
export function decodeTubeTrailMesh(
  properties: Record<string, string>,
  curve: TscnInternalResource | null
): TubeTrailMeshProperties {
  return {
    ...decodeTrailMeshBase(properties, curve, 'TubeTrailMesh'),
    radius: approxDefaultFloatOr(properties.radius, DEFAULT_RADIUS, 'TubeTrailMesh radius'),
    radialSteps: settableIntOr(
      properties.radial_steps,
      8,
      { min: 3, max: 128 },
      'TubeTrailMesh radial_steps'
    ),
    sectionRings: settableIntOr(
      properties.section_rings,
      3,
      { min: 1, max: 1024 },
      'TubeTrailMesh section_rings'
    ),
    capTop: boolSlotValue(properties.cap_top) !== false,
    capBottom: boolSlotValue(properties.cap_bottom) !== false,
  };
}
