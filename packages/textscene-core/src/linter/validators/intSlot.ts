/**
 * The INT-slot refusal, shared by every combinator that reads one.
 *
 * `parseGodotInt` returns `null` for text the tokenizer cannot read and `NaN`
 * for a literal that reads but the slot cannot hold. Only the first was ever
 * gated, and NaN fails every comparison, so 308 of 542 int slots said nothing.
 */

import type { ParseError } from '../types.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import {
  INT32_MAX,
  parseGodotFloat,
  readerLimitedInt,
  storedFromFloat,
  type IntWidth,
} from '../../godot/index.js';

/**
 * `_to_int<T>` (`variant.h:360-377`) — the conversion every int slot's write
 * goes through, and the authority for refusing a literal it cannot carry.
 */
const INT_SLOT_CITE = 'variant.h:360-377';

/**
 * Error for a value that read but cannot be stored; `null` for a usable number.
 *
 * Never names the result. The FLOAT branch (`variant.h:369-370`) is undefined
 * behaviour and architecture-specific — measured on 4.6.3 x86_64, `light_mask =
 * 3e9` stores -2147483648 where the INT literal `3000000000` stores
 * -1294967296 — so the ALTERATION is the portable claim and the message quotes
 * the literal instead.
 *
 * `width` separates two refusals `storedFromFloat` answers with the same NaN.
 * At uint8/int32/uint32 the C++ type is narrower than a double, so NaN means
 * the ENGINE alters the value and the error tier is earned. At int64 it is
 * wider: past 2^53 the double stops being the integer the file states while
 * `_to_int` carries it intact, so the limit is THIS reader's. Reporting that as
 * an alteration told the author Godot cannot hold a value it holds exactly, at
 * a severity that fails `lint:scenes` on a valid file. It stays a diagnostic
 * rather than silence because the caller reads the NaN as "already reported"
 * and would otherwise carry it into its own arithmetic.
 */
export function unrepresentableInt(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  num: number | null,
  width: IntWidth = 'int32'
): ParseError | null {
  if (num === null || !Number.isNaN(num)) return null;
  const beyondReader = readerLimitedInt(parseGodotFloat(value) ?? NaN, width);
  if (beyondReader) {
    return propertyError(
      key,
      line,
      `Property '${propertyName}' is outside the range this linter reads exactly, got: "${value}". ` +
        `An int64 slot holds it and Godot stores what the file states; no bound on this value is checked here.`,
      errorCodeValue,
      'warning'
    );
  }
  return propertyError(
    key,
    line,
    `Property '${propertyName}' cannot be stored in an integer slot, got: "${value}". ` +
      `The file loads, but the value Godot stores is not the one the file states.`,
    errorCodeValue,
    'error'
  );
}

/**
 * The width a slot reads at, from its own declared ceiling.
 *
 * A maximum above int32 is unreachable unless the slot is unsigned, so the
 * width is derived rather than asked of 50-odd call sites. Measured on 4.6.3
 * the two genuinely disagree: `MeshInstance3D.layers = 4294967295` stores
 * 4294967295 (uint32) where `Node2D.light_mask = 4294967295` stores -1 (int32).
 */
export function slotWidth(max?: number | null): IntWidth {
  return (max ?? 0) > INT32_MAX ? 'uint32' : 'int32';
}

/**
 * Both readings of one literal, from ONE parse.
 *
 * An int slot asks two questions of the same text — what does the slot store,
 * and was anything dropped getting there — and the second needs the double the
 * first was derived from. Reading them separately parsed every CLEAN int
 * property twice to detect a condition a clean value does not have. Same shape
 * as `badIntElement`, which pays the array-element half of the same cost.
 */
export interface IntSlotRead {
  /** The tokenizer's double, or `null` for text outside the grammar. */
  readonly asFloat: number | null;
  /** The integer stored: `null` unreadable, `NaN` read but unstorable. */
  readonly stored: number | null;
}

/**
 * A literal as the integer this slot stores, beside the double it came from.
 *
 * The width goes IN, rather than being applied to the result: `_to_int`'s FLOAT
 * branch is undefined outside the target type's range, so which values are
 * refusable is a fact about the slot. Narrowing afterwards asked int32's
 * question of every slot and then re-read the answer as unsigned, which refused
 * `seed = 4294967295.0` at the ceiling its own `PROPERTY_HINT_RANGE` declares.
 */
export function readIntSlot(value: string, max?: number | null, width?: IntWidth): IntSlotRead {
  const asFloat = parseGodotFloat(value);
  if (asFloat === null) return { asFloat: null, stored: null };
  return { asFloat, stored: storedFromFloat(asFloat, value, width ?? slotWidth(max)) };
}

/**
 * Tag a validator as reading an INT slot.
 *
 * Two jobs. It clears `formatOnly`, which an int slot can never be: `inf` READS
 * (`variant_parser.cpp:701-707`) and is then altered on the write, so the
 * refusal is of a real value and owes a citation.
 *
 * And it is the population `nonFiniteInts.test.ts` sweeps. Derived from the tag
 * rather than from the `accepts` prose, which missed all 50 layer masks:
 * `layerBitmask` overwrites the tag with `32-bit layer mask (layers 1-32)`,
 * matching neither `integer` nor `bit mask`.
 *
 * `width` is the slot's C++ type, and the sweep needs it: `4294967296` is
 * unstorable in an int32 slot and stored exactly in an int64 one, so a single
 * list of refusable literals would be wrong for one of the two.
 *
 * It deliberately does NOT set `grounding`. That tag answers a different
 * question — where a BOUND's authority comes from — and filling it here let a
 * bounded int combinator with no citation satisfy `boundGrounding`'s ratchet
 * for free. `validatorClassification` accepts `intSlot` as classification only
 * for a validator carrying no bounds.
 */
export function markIntSlot<T extends PropertyValidator>(
  validator: T,
  width: IntWidth = 'int32'
): T {
  delete validator.formatOnly;
  validator.intSlot = { cite: INT_SLOT_CITE, width };
  return validator;
}

/**
 * The warning for a fractional literal in an INT slot, or `null` for a whole one.
 *
 * Godot loads `hframes = 5.5` and stores 5 — measured on 4.6.3, silently. The
 * value the engine holds is not the value the file states, which is worth
 * saying; but the alteration happens in the Variant conversion
 * (`variant.h:369-370`) on the way INTO the setter, and `set_hframes` only ever
 * sees the 5. ADR-0032 reserves the error tier for the setter's own behaviour,
 * so this is its own row: the third tier, for a binding-layer conversion.
 *
 * A `_VALUE` code, never `_FORMAT`: the tokenizer reads `5.5` perfectly well
 * (`variant_parser.cpp:443-448` types it FLOAT), and three combinators used to
 * report it as a format failure — telling a reader the file is unparseable
 * when the engine opens it without complaint.
 *
 * Checked LAST, after every bound: a value that is both fractional and out of
 * range has a genuine error to report, and that outranks this.
 *
 * Takes the caller's {@link IntSlotRead} rather than the raw text: the float
 * this needs is the one the stored int was derived from, so re-reading it here
 * parsed the same literal a second time on every clean property.
 */
export function truncatedInt(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  read: IntSlotRead
): ParseError | null {
  const { asFloat, stored } = read;
  if (stored === null || Number.isNaN(stored)) return null;
  if (asFloat === null || Number.isInteger(asFloat)) return null;
  return propertyError(
    key,
    line,
    `Property '${propertyName}' is an integer slot, so Godot drops the fractional part of "${value}" and stores ${stored}.`,
    errorCodeValue,
    'warning'
  );
}

/**
 * {@link truncatedInt} for the COMPONENTS of an integer composite.
 *
 * `_parse_construct<int32_t>` (`variant_parser.cpp:577-592`) takes any number
 * token and narrows it, which is the same conversion a scalar int slot performs
 * — so `Vector2i(1.5, 2)` stores `(1, 2)` exactly as `hframes = 5.5` stores 5.
 * The scalar half warned while the composite half was silent, which made the
 * tier depend on the shape of the property rather than on the engine.
 *
 * Its callers match on the linter's WIDENED grammar, which admits `inf`/`nan`
 * deliberately, so this guards finiteness itself rather than trusting the
 * regex — both live callers happen to refuse a non-finite component first, and
 * that is their choice to change.
 */
export function truncatedComponent(
  propertyName: string,
  key: string,
  line: number,
  components: readonly (string | undefined)[],
  errorCodeValue: string
): ParseError | null {
  for (const text of components) {
    if (text === undefined) continue;
    const asFloat = parseGodotFloat(text);
    // `Number.isFinite` first: `Number.isInteger(Infinity)` and
    // `Number.isInteger(NaN)` are both FALSE, so `inf`/`nan` fell through to
    // `stores ${Math.trunc(asFloat)}` and printed "stores Infinity" — a value
    // ADR-0032 forbids naming, since the conversion is undefined. A non-finite
    // component is the unstorable REFUSAL, reported by the caller's own arm.
    if (asFloat === null || !Number.isFinite(asFloat) || Number.isInteger(asFloat)) continue;
    return propertyError(
      key,
      line,
      `Property '${propertyName}' has integer components, so Godot drops the fractional part of "${text.trim()}" and stores ${Math.trunc(asFloat)}.`,
      errorCodeValue,
      'warning'
    );
  }
  return null;
}
