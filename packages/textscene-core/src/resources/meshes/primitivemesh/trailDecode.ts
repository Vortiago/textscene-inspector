/**
 * What TubeTrailMesh and RibbonTrailMesh decode the same way: the sections, their length and the
 * Curve. Each type cites its own setters.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { isEqualApprox } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { floatOr, settableIntOr } from '../../../parser/valueParsers';
import { decodeCurveResource } from '../../curves/curve/decode';
import type { Curve } from '../../curves/curve/types';

/** The properties every trail mesh holds. */
export interface TrailMeshBase {
  sections: number;
  sectionLength: number;
  /** Scales the extent along the mesh. Null for no curve, which the mesh reads as a scale of 1. */
  curve: Curve | null;
}

/**
 * A float whose setter returns early for a value `is_equal_approx` to the one it holds, and the
 * mesh holds the default until a setter stores another (`set_radius`, `set_size`).
 */
export function approxDefaultFloatOr(raw: string | undefined, fallback: number, context: string): number {
  const value = storedReal(floatOr(raw, fallback, context));
  return isEqualApprox(value, fallback) ? fallback : value;
}

/**
 * `set_sections` ERR_FAILs outside 2 to 128 and keeps the default of 5. `set_section_length` is a
 * bare assignment. `label` is the type name, for the warnings.
 */
export function decodeTrailMeshBase(
  properties: Record<string, string>,
  curve: TscnInternalResource | null,
  label: string
): TrailMeshBase {
  return {
    sections: settableIntOr(properties.sections, 5, { min: 2, max: 128 }, `${label} sections`),
    sectionLength: storedReal(floatOr(properties.section_length, 0.2, `${label} section_length`)),
    curve: decodeCurveResource(curve),
  };
}
