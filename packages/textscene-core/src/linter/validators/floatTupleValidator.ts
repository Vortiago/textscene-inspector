/** Arity-driven validator for fixed-length float-tuple TSCN values. */

import { compositeSpellings, compositeTypeName, isConvertedSpelling } from '../../godot/variantConversion.js';
import { slotComponentsAltered } from '../../godot/int.js';
import { truncatedComponent } from './intSlot.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { valueCode } from './v/codes.js';
import { TSCN_FLOAT_PATTERN_SOURCE } from './commonValidators.js';

/**
 * The anchored regex for a fixed-arity float tuple like `Vector3(x, y, z)`, one
 * capture group per component. Components use {@link TSCN_FLOAT_PATTERN_SOURCE},
 * which adds `inf`/`-inf`/`inf_neg`/`nan` to the renderer's finite grammar,
 * since Godot writes a non-finite component into every real-typed composite.
 */
export function makeFloatTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${TSCN_FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join('\\s*,\\s*');
  // A slot accepts every spelling `can_convert_strict` converts into it.
  // Whitespace before `(` is legal: `_parse_construct` takes the parenthesis from
  // its own `get_token` (variant_parser.cpp:553-557), which skips chars <= 32 (:416-418).
  // `slotTupleRegex` must match outside the component grammar (`godotLiteralGrammar.guard.test.ts`).
  return new RegExp(`^${compositeSpellings(typeName)}\\s*\\(\\s*${body}\\s*\\)$`);
}

/**
 * A validator that a property value is `typeName(<arity floats>)`. `expectation`
 * is the per-type "must be …" suffix, for example `Vector3 with 3 numbers like
 * Vector3(0, 0, 0)`.
 */
export function floatTupleValidator(
  propertyName: string,
  typeName: string,
  arity: number,
  expectation: string,
  errorCode: string
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  // The alteration is reported here, not by each bound: it is a property of the
  // spelling, and a slot with no bound, such as `v.vector2('start_position')`,
  // has no other reporter.
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
    // The `i`-suffixed spelling narrows through `_parse_construct<int32_t>`
    // before widening into this float slot. A component that does not survive
    // is the ADR-0032 error tier. The message quotes the literal, not the stored
    // number, which is architecture-specific (`variant.h:369-370`) or a wrap.
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
    // The same narrowing on a component the engine can store: `Vector2i(1.5, 2)`
    // reaches `_parse_construct<int32_t>` (variant_parser.cpp:721-723) and is
    // stored as `(1, 2)`, the truncation the scalar int slot warns about.
    if (isConvertedSpelling(typeName, compositeTypeName(value))) {
      return truncatedComponent(propertyName, key, line, match.slice(1, arity + 1), alteredCode);
    }
    return null;
  };
}
