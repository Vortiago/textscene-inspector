import type { UtilityResult } from './callError.js';
import type { GlobalRandom } from './globalRandom.js';
import type { CastArgument } from './utilityArguments.js';
import type { Variant } from '../value/variant.js';

/** A FUNCBINDR or FUNCBIND function: its arguments as `VariantCaster` casts them, and its return. */
export type TypedFunction = (args: readonly CastArgument[], random: GlobalRandom) => Variant;

/** A FUNCBINDVR or vararg function: it reads the Variants and sets its own call error. */
export type VariantFunction = (args: readonly Variant[]) => UtilityResult;
