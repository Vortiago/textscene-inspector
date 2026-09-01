/** Arity-driven validator for fixed-length float-tuple TSCN values. */

import { compositeSpellings } from '../../godot/variantConversion.js';
import { slotComponentsAltered } from '../../godot/int.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { valueCode } from './v/codes.js';
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
 * sibling `slotTupleRegex` spells the same thing; the two must stay identical
 * outside the component grammar, which `godotLiteralGrammar.guard.test.ts` now
 * asserts behaviourally.
 */
export function makeFloatTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${TSCN_FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join('\\s*,\\s*');
  // Same alternation as the renderer's builder, from the same table: a slot
  // accepts every spelling `can_convert_strict` converts into it.
  return new RegExp(`^${compositeSpellings(typeName)}\\s*\\(\\s*${body}\\s*\\)$`);
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
  // The alteration is reported HERE rather than by each bound that reads the
  // components, because it is a property of the SPELLING and every float-tuple
  // slot in the registry is built from this one function. A slot with no bound
  // at all — `v.vector2('start_position')` — has no other reporter, and the
  // rules that read such a slot must stay silent about a number the engine
  // narrowed, so without this the write is dropped by Godot and named nowhere.
  const alteredCode = valueCode(propertyName);
  return (key, value, line) => {
    const match = regex.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${expectation}, got: "${value}"`,
        errorCode
      );
    }
    // `compositeSpellings` admits the `i`-suffixed constructor
    // `can_convert_strict` converts, whose arguments are narrowed through
    // `_parse_construct<int32_t>` BEFORE the widening into this float slot. A
    // component that survives that is a value the file states; one that does
    // not is stored as something the file never names — the ADR-0032 error
    // tier. The message quotes the literal and never the stored number, which
    // is architecture-specific (`variant.h:369-370`) or a wrap.
    if (slotComponentsAltered(value, typeName, match.slice(1, arity + 1))) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' has a component Godot cannot store in the ` +
          `integer spelling it is written in, got: "${value}". The file loads, but ` +
          `the components are narrowed at parse time to a number the file does not state`,
        alteredCode
      );
    }
    return null;
  };
}
