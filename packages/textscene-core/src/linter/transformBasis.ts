/**
 * The basis of a serialised `Transform3D`, read with the LINTER's float
 * grammar, plus the two `Basis` questions Godot's configuration warnings ask of
 * it.
 *
 * `utils/transform.ts`'s `parseTransform3D` matches the FINITE grammar and
 * throws on `inf`/`-inf`/`inf_neg`/`nan` — legal components Godot writes and
 * reloads (`variant_parser.cpp:149-157`) — so every rule that read a basis
 * through it swallowed the throw and reported nothing at all about a transform
 * the engine warns about. The renderer keeps its finite grammar for the reason
 * its own docblock gives; a diagnostic must not.
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
 * `null` when it does not parse — a malformed literal is `linterParser.ts`'s
 * job (inherited from Node3D), not a semantic rule's, and reporting it twice is
 * one defect reported twice.
 */
export function transform3DBasis(raw: string): BasisComponents | null {
  const match = TRANSFORM3D_REGEX.exec(raw);
  if (!match) return null;
  const n = match.slice(1, 10).map(tupleComponent);
  return [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!, n[6]!, n[7]!, n[8]!];
}

/**
 * Whether a serialised `Transform3D`'s scale differs from `(1, 1, 1)`.
 *
 * Godot asks this in several unrelated configuration warnings —
 * `Light3D`'s "a light's scale does not affect the visual size of the light"
 * (`light_3d.cpp:183`) and `XROrigin3D`'s "changing the scale is not supported"
 * (`xr_nodes.cpp:698`) among them — always as
 * `!get_scale().is_equal_approx(Vector3(1, 1, 1))` on the node's OWN local
 * transform, never a composed global one.
 *
 * A malformed literal answers `false`: rejecting it is the strict parser's job.
 * A NON-FINITE component is not malformed, and answers `true` — `get_scale`
 * carries it (or the 0 its NaN determinant signs to) into an axis that no
 * comparison calls 1.
 */
export function hasNonUnitScale3D(rawTransform: string | undefined): boolean {
  if (rawTransform === undefined) return false;
  const basis = transform3DBasis(rawTransform);
  if (basis === null) return false;
  return !basisHasUnitScale(basis);
}

/**
 * Whether a serialised `Transform3D`'s basis is orthonormal
 * (`Basis::is_orthonormal`, basis.cpp:103-107), or `null` when the literal does
 * not parse.
 *
 * A basis carrying `inf` is NOT orthonormal — the column's `length_squared()`
 * is `inf` — which is the whole difference between this and the finite read it
 * replaced.
 */
export function isOrthonormalTransform(raw: string): boolean | null {
  const basis = transform3DBasis(raw);
  if (basis === null) return null;
  return basisIsOrthonormal(basis);
}
