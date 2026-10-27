/**
 * Integer readers for rules and for the components of an `i`-suffixed
 * composite in a float slot. `intReader.ts` has the engine conversion they build on.
 */

import { matchedFloat, slotTupleRegex } from './number.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';
import { INT32_MAX } from './intWidth.js';
import type { IntWidth } from './intWidth.js';
import { isAlteredInt, parseSlotInt, statedFromFloat, storedFromFloat } from './intReader.js';
import { scalarSlotValue } from './variantBool.js';

/**
 * The width a slot reads at, from its own declared ceiling: a maximum above
 * int32 is unreachable unless the slot is unsigned. `MeshInstance3D.layers =
 * 4294967295` stores 4294967295 (uint32), and `Node2D.light_mask` stores -1 (int32).
 */
export function slotWidth(max?: number | null): IntWidth {
  return (max ?? 0) > INT32_MAX ? 'uint32' : 'int32';
}

/**
 * Both readings of one literal, from one parse: what the slot stores, and the
 * double it came from, which the truncation check needs. `badIntElement` has
 * the same shape for an array element.
 */
export interface IntSlotRead {
  /** The double the slot read, or `null` for text outside the grammar. */
  readonly asFloat: number | null;
  /** The integer stored: `null` unreadable, `NaN` read but unstorable. */
  readonly stored: number | null;
}

/**
 * A literal as an {@link IntSlotRead}: the integer this slot stores, beside the
 * double it came from. The validators call it for the number the file states, and {@link ruleInt}
 * narrows it for the rules. The decoders read the number the slot stores through {@link parseSlotInt}.
 * The width goes in, not onto the result: `_to_int`'s FLOAT branch is undefined
 * outside the target type's range, so a uint32 `seed = 4294967295.0` is legal.
 */
export function readIntSlot(
  value: string,
  max?: number | null,
  width?: IntWidth,
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): IntSlotRead {
  const asFloat = scalarSlotValue(value);
  if (asFloat === null) return { asFloat: null, stored: null };
  return { asFloat, stored: statedFromFloat(asFloat, value, width ?? slotWidth(max), alwaysFloatBranch) };
}

/**
 * The int a rule may compare, or `null` for anything it must not: an unreadable literal, and one the
 * file does not state ({@link isAlteredInt}), where phase 1 already reports the alteration and a
 * second finding over the wrapped number would repeat it. `whenAbsent` stands for a missing key, where
 * Godot's default is not zero (`hframes` is 1). The renderer reads {@link slotInt}.
 */
export function ruleInt(
  raw: string | undefined,
  whenAbsent: number | null = null,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  if (raw === undefined) return whenAbsent;
  const { stored } = readIntSlot(raw, null, width, alwaysFloatBranch);
  return stored === null || Number.isNaN(stored) ? null : stored;
}

/**
 * The int the slot stores, or `null` for text Godot cannot read or a FLOAT it cannot convert. An INT
 * literal past the round-trip band wraps, so the renderer draws what Godot holds. Same shape as
 * {@link ruleInt}, which the linter uses.
 *
 * @oneWay An integer in an int slot
 */
export function slotInt(
  raw: string | undefined,
  whenAbsent: number | null = null,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  if (raw === undefined) return whenAbsent;
  const parsed = parseSlotInt(raw, width, alwaysFloatBranch);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

/** An array count: the engine refuses a negative one, so the array keeps its default. */
function nonNegativeCount(count: number | null, whenAbsent: number): number | null {
  // `null` still means unreadable, and still travels: phase 1 has already
  // reported that text, and a rule owes silence rather than a second
  // diagnostic naming a number it had to invent.
  if (count === null) return null;
  // Every serialised array count's setter opens with `ERR_FAIL_COND(p_count < 0)` (item_list.cpp:527,
  // popup_menu.cpp:2698, file_dialog.cpp:2039, tab_bar.cpp:745, option_button.cpp:310,
  // menu_button.cpp:124, `_set_setting_count` at ik_modifier_3d.h:98), so the array keeps its default.
  return count < 0 ? whenAbsent : count;
}

/**
 * The array count a rule may compare against, or `null` for text it must not. A negative count is
 * refused, so a rule reads the default the engine keeps, not the authored number that the
 * `enforced:` validator already reports.
 */
export function ruleCount(raw: string | undefined, whenAbsent = 0): number | null {
  return nonNegativeCount(ruleInt(raw, whenAbsent), whenAbsent);
}

/** {@link ruleCount} as the slot stores it, for the renderer. */
export function slotCount(raw: string | undefined, whenAbsent = 0): number | null {
  return nonNegativeCount(slotInt(raw, whenAbsent), whenAbsent);
}

/**
 * One matched component of an `i`-suffixed composite as the int32 Godot stores (`vector2i.h:56-57`),
 * or `null` when no int32 holds it. Narrowed, so renderer and linter read one number. It takes a
 * capture the finite grammar matched: text from a file goes through {@link parseGodotInt}.
 * Whether the file states that number is {@link isAlteredInt}.
 */
export function storedInt(
  text: string | undefined,
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  const num = matchedFloat(text ?? '');
  if (!Number.isFinite(num)) return null;
  const stored = storedFromFloat(num, text ?? '', 'int32', alwaysFloatBranch);
  return Number.isNaN(stored) ? null : stored;
}

/** The `Vector2i` slot grammar: every spelling `can_convert_strict` converts into it. */
const VECTOR2I_SLOT_RE = slotTupleRegex('Vector2i', 2);

/** Why a `Vector2i` slot stores nothing: no spelling it takes, or a component no int32 holds. */
type Vector2iRefusal = 'malformed' | 'unstorable';

/**
 * A `Vector2i` slot's literal as the pair Godot stores. A `Vector2(...)` holds doubles, so both
 * components take the `double -> int32` branch whatever the token looks like. Measured on 4.6.3:
 * `Vector2(4294967295, 64)` stores `(-2147483648, 64)`, `Vector2i(4294967295, 64)` `(-1, 64)`.
 */
export function storedVector2i(raw: string): { x: number; y: number } | Vector2iRefusal {
  const literal = raw.trim();
  const match = VECTOR2I_SLOT_RE.exec(literal);
  if (!match) return 'malformed';
  const converted = isConvertedSpelling('Vector2i', compositeTypeName(literal));
  const x = storedInt(match[1], converted);
  const y = storedInt(match[2], converted);
  if (x === null || y === null) return 'unstorable';
  return { x, y };
}

/**
 * The matched components of a composite in a FLOAT slot, each read as its spelling stores it.
 * `_parse_construct<int32_t>` (`variant_parser.cpp:721-733`) narrows `Vector2i(...)` arguments before
 * the widening, so `Vector2i(4294967295, 0)` reaches a `Vector2` slot as `(-1, 0)` and `Vector2i(1.5, 0)`
 * as `(1, 0)`. An unstorable component is NaN, so the caller's `allFinite` check falls back.
 */
export function slotComponents(
  literal: string,
  /** The slot's own type name, such as `Vector2`, not the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[],
  /**
   * How a FLOAT component reads, for the caller's grammar: `matchedFloat` for the finite `slotTupleRegex`.
   * The linter's `makeFloatTupleRegex` admits `inf`/`nan`, which `parseFloat` reads as NaN. NaN in the
   * result is a legal non-finite float or an altered int, as `stor_fix` (`variant_parser.cpp:149-159`,
   * `:577-586`) hands `inf` to `_parse_construct<int32_t>` too: {@link slotComponentsAltered} tells them apart.
   */
  readFloat: (text: string) => number = matchedFloat
): number[] {
  const asInt = isConvertedSpelling(floatTypeName, compositeTypeName(literal));
  return captures.map((capture) => (asInt ? (storedInt(capture) ?? NaN) : readFloat(capture ?? '')));
}

/**
 * Whether the `i` spelling in a FLOAT slot narrows a component to a number the file does not state,
 * which a NaN from {@link slotComponents} cannot show. Same reader as {@link slotComponents}. A non-finite
 * one reads (`variant_parser.cpp:149-159`, `:577-586`) and narrows undefined outside int32 (`variant.h:369-370`),
 * and `4294967296` wraps to a number the file does not state. A caller reports the alteration (ADR-0032) and the literal.
 */
export function slotComponentsAltered(
  literal: string,
  /** The slot's own type name, such as `Vector2`, not the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[]
): boolean {
  if (!isConvertedSpelling(floatTypeName, compositeTypeName(literal))) return false;
  return captures.some((capture) => isAlteredInt(matchedFloat(capture ?? ''), capture ?? '', 'int32'));
}

/** A composite literal in a FLOAT slot, as every reader of one sees it. */
export interface SlotTuple {
  /** Each component as {@link slotComponents} reads it. */
  readonly components: number[];
  /** Whether the `i` spelling narrows a component to a number the file does not state. */
  readonly altered: boolean;
}

/**
 * The one read of a composite in a FLOAT slot, or `null` when the caller's `grammar` refuses the
 * literal. Each reader keeps its own contract on top: the linter withholds an altered value, and
 * the renderer falls back on a non-finite component.
 */
export function readSlotTuple(
  literal: string,
  /** The slot's own type name, such as `Vector2`, not the spelling in the file. */
  floatTypeName: string,
  /** The caller's anchored tuple grammar, one capture per component. */
  grammar: RegExp,
  /** See {@link slotComponents}. */
  readFloat: (text: string) => number = matchedFloat
): SlotTuple | null {
  const trimmed = literal.trim();
  const match = grammar.exec(trimmed);
  if (!match) return null;
  const captures = match.slice(1);
  return {
    components: slotComponents(trimmed, floatTypeName, captures, readFloat),
    altered: slotComponentsAltered(trimmed, floatTypeName, captures),
  };
}
