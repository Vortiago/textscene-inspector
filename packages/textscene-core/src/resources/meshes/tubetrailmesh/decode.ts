/**
 * TubeTrailMesh decode. Defaults: `primitive_meshes.h:420-428`. `set_radial_steps`
 * (`primitive_meshes.cpp:2402`), `set_sections` (:2414) and `set_section_rings` (:2437) ERR_FAIL
 * outside 3 to 128, 2 to 128 and 1 to 1024, and keep the default. `set_radius` (:2388) ignores a
 * value `is_equal_approx` to the one it holds.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { isEqualApprox } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { floatOr, settableIntOr } from '../../../parser/valueParsers';
import { resolveCurve } from '../../curves/curve/decode';
import type { TubeTrailMeshProperties } from './types';

const DEFAULT_RADIUS = 0.5;

/** The property that names the one sub-resource the builder reads. */
export const CURVE_PROPERTY = 'curve';

/** `internalResources` is the table the mesh's `curve` reference resolves in. */
export function decodeTubeTrailMesh(
  properties: Record<string, string>,
  internalResources: readonly TscnInternalResource[]
): TubeTrailMeshProperties {
  const radius = storedReal(floatOr(properties.radius, DEFAULT_RADIUS, 'TubeTrailMesh radius'));
  return {
    radius: isEqualApprox(radius, DEFAULT_RADIUS) ? DEFAULT_RADIUS : radius,
    radialSteps: settableIntOr(
      properties.radial_steps,
      8,
      { min: 3, max: 128 },
      'TubeTrailMesh radial_steps'
    ),
    sections: settableIntOr(properties.sections, 5, { min: 2, max: 128 }, 'TubeTrailMesh sections'),
    sectionLength: storedReal(floatOr(properties.section_length, 0.2, 'TubeTrailMesh section_length')),
    sectionRings: settableIntOr(
      properties.section_rings,
      3,
      { min: 1, max: 1024 },
      'TubeTrailMesh section_rings'
    ),
    capTop: boolSlotValue(properties.cap_top) !== false,
    capBottom: boolSlotValue(properties.cap_bottom) !== false,
    curve: resolveCurve(properties[CURVE_PROPERTY], internalResources),
  };
}
