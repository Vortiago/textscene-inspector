/** Arity-driven validator for fixed-length float-tuple TSCN values. */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { TSCN_FLOAT_PATTERN_SOURCE } from './commonValidators.js';

/**
 * Build the anchored regex for a fixed-arity float tuple like `Vector3(x, y, z)`
 * or `Color(r, g, b, a)`. Each component is a capture group, so callers that
 * `.exec()` the returned regex still read `match[1..arity]`.
 *
 * Components use {@link TSCN_FLOAT_PATTERN_SOURCE} — Godot's tokenizer grammar,
 * which is the renderer's `FLOAT_PATTERN_SOURCE` (`5.`, scientific notation, no
 * leading `+` or `.`) PLUS `inf` / `-inf` / `inf_neg` / `nan`. The linter deliberately
 * accepts MORE than the renderer parses here: Godot writes a non-finite
 * component into every real-typed composite, so reporting one is a false
 * positive, while feeding `Infinity` to three.js is NaN geometry. The renderer
 * keeps its finite grammar and substitutes its documented default instead;
 * `TSCN_FLOAT_PATTERN_SOURCE`'s docblock holds the full argument.
 *
 * The type name and the `(` are two separate tokens, so whitespace between them
 * is legal: `_parse_construct` takes `TK_PARENTHESIS_OPEN` from its own
 * `get_token` call (variant_parser.cpp:553-557), and `get_token` discards every
 * character <= 32 before a token (:416-418). `Vector2 (1, 2)` is therefore a
 * file Godot loads, and refusing it reported a format error on a hand-edited
 * scene the engine opens — which is the file a linter exists for. The finite
 * sibling `finiteTupleRegex` spells the same thing; the two must stay identical
 * outside the component grammar, which `godotLiteralGrammar.guard.test.ts` now
 * asserts behaviourally.
 */
export function makeFloatTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${TSCN_FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join('\\s*,\\s*');
  return new RegExp(`^${typeName}\\s*\\(\\s*${body}\\s*\\)$`);
}

/**
 * A validator that a property value is `typeName(<arity floats>)`. `expectation`
 * is the human-readable "must be …" suffix (kept per-type so wording stays
 * exact, e.g. `Vector3 with 3 numbers like Vector3(0, 0, 0)` vs `Rect2 format
 * like Rect2(0, 0, 100, 100)`).
 */
export function floatTupleValidator(
  propertyName: string,
  typeName: string,
  arity: number,
  expectation: string,
  errorCode: string
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  return (key, value, line) => {
    if (!regex.test(value)) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${expectation}, got: "${value}"`,
        errorCode
      );
    }
    return null;
  };
}
