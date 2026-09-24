/**
 * The declarative validator namespace `v`, which makes each `linterParser.ts` a
 * flat property-to-combinator map. `v.xxx(propertyName, options?)` returns a
 * `PropertyValidator` whose error codes derive from the property name. The
 * combinators, one value family per file in `v/`, wrap the `create*Validator` factories.
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

/** The declarative validator namespace: `v.float`, `v.enumInt` and the rest. */
export const v = {
  ...floatCombinators,
  ...integerCombinators,
  ...scalarCombinators,
  ...keyVerdictCombinators,
  ...referenceCombinators,
  ...vectorCombinators,
  ...packedArrayCombinators,
};
