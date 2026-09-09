/**
 * Declarative validator namespace `v` — the thin DSL that lets each
 * node's `linterParser.ts` become a flat property → combinator map.
 *
 * Before this file the 31
 * `linterParser.ts` files totalled 9,488 LOC of near-identical
 * `parseFloat → NaN check → range check → return {ParseError shape}`.
 * Each validator now collapses to a single call site of ~30 chars.
 *
 * Each `v.xxx(propertyName, options?)` returns a `PropertyValidator`
 * (`(key, value, line) => ParseError | null`). Error codes are
 * auto-derived from the property name (uppercase + `_FORMAT` / `_VALUE`
 * suffix), so per-property call sites no longer pass them. Message
 * text follows the same template the existing files use (so all
 * `expect(msg).toContain('cast_shadow')` and `toContain('0-3')` style
 * tests keep passing).
 *
 * Built on top of the existing `create*Validator` factories in this
 * directory; this file is a façade, not a re-implementation.
 *
 * ## Where the combinators live
 *
 * One file per value family in `v/`, each over the shared tagging and grounding
 * helpers in `v/grounding.ts`. This module assembles them into the namespace and
 * keeps the import path every slice already uses, so a combinator moves between
 * families without moving any call site.
 */

import { floatCombinators } from './v/floats.js';
import { integerCombinators } from './v/integers.js';
import { keyVerdictCombinators } from './v/keyVerdicts.js';
import { packedArrayCombinators } from './v/packedArrays.js';
import { referenceCombinators } from './v/references.js';
import { scalarCombinators } from './v/scalars.js';
import { vectorCombinators } from './v/vectors.js';

export { accepts, shape, type Grounding } from './v/grounding.js';
export { arrayLiteralElements } from './v/scalars.js';
export { RADIAN_ROUNDTRIP_EPSILON } from './v/floats.js';
export type { FloatOpts, IntOpts, EnumOpts } from './v/options.js';

/**
 * The declarative validator namespace. Use as `v.float`, `v.enumInt`, etc.
 */
export const v = {
  ...floatCombinators,
  ...integerCombinators,
  ...scalarCombinators,
  ...keyVerdictCombinators,
  ...referenceCombinators,
  ...vectorCombinators,
  ...packedArrayCombinators,
};
