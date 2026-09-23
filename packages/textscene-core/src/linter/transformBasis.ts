/**
 * The basis of a serialised `Transform3D`, read with the linter's float
 * grammar, plus the two `Basis` questions Godot's configuration warnings ask.
 * Not `parseTransform3D`: its finite grammar throws on `inf`/`-inf`/`inf_neg`/`nan`,
 * legal components Godot writes and reloads (`variant_parser.cpp:149-157`).
 */

import { makeFloatTupleRegex } from './validators/floatTupleValidator.js';
import { tupleComponent } from './validators/commonValidators.js';
import {
  type BasisComponents,
  basisHasUnitScale,
  basisIsOrthonormal,
} from '../godot/basis.js';

const TRANSFORM3D_REGEX = makeFloatTupleRegex('Transform3D', 12);

/**
 * The nine row-major basis components of a `Transform3D(...)` literal, or
 * `null` when it does not parse. A malformed literal is `linterParser.ts`'s
 * job (inherited from Node3D), not a semantic rule's.
 */
export function transform3DBasis(raw: string): BasisComponents | null {
  const match = TRANSFORM3D_REGEX.exec(raw);
  if (!match) return null;
  const n = match.slice(1, 10).map(tupleComponent);
  return [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!, n[6]!, n[7]!, n[8]!];
}

/**
 * Whether a serialised `Transform3D`'s scale differs from `(1, 1, 1)`, asked as
 * `!get_scale().is_equal_approx(Vector3(1, 1, 1))` on the node's own local
 * transform by `Light3D` (`light_3d.cpp:183`) and `XROrigin3D` (`xr_nodes.cpp:698`).
 * A malformed literal answers `false`: rejecting it is the strict parser's job.
 */
export function hasNonUnitScale3D(rawTransform: string | undefined): boolean {
  if (rawTransform === undefined) return false;
  const basis = transform3DBasis(rawTransform);
  if (basis === null) return false;
  // A non-finite component answers true: get_scale carries it, or the 0 its NaN
  // determinant signs to, into an axis that no comparison calls 1.
  return !basisHasUnitScale(basis);
}

/**
 * Whether a serialised `Transform3D`'s basis is orthonormal
 * (`Basis::is_orthonormal`, basis.cpp:103-107), or `null` when the literal does
 * not parse. A basis carrying `inf` is not orthonormal: the column's
 * `length_squared()` is `inf`.
 */
export function isOrthonormalTransform(raw: string): boolean | null {
  const basis = transform3DBasis(raw);
  if (basis === null) return null;
  return basisIsOrthonormal(basis);
}
