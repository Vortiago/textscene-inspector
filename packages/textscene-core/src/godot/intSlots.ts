/**
 * Integer readers for rules and for the components of an `i`-suffixed
 * composite in a float slot. See `int.ts` for the whole picture.
 */

import { matchedFloat } from './number.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';
import type { IntWidth } from './intWidth.js';
import { parseGodotInt, storedFromFloat } from './intReader.js';

/**
 * The int a rule may compare, or `null` for anything it must not: `parseGodotInt`'s `NaN` fails every
 * comparison and would silence the rule, and phase 1 already reports it. `whenAbsent` stands for a
 * missing key, where Godot's default is not zero (`hframes` is 1). Here, not beside the validators:
 * render decoders (`gridmap/cellData.ts`, `tiles/shared/tileData.ts`) read it without the linter.
 */
export function ruleInt(
  raw: string | undefined,
  whenAbsent: number | null = null,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  if (raw === undefined) return whenAbsent;
  const parsed = parseGodotInt(raw, width, alwaysFloatBranch);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

/**
 * The array count a rule may compare against, or `null` for text it must not. A negative count is
 * refused, so a rule reads the default the engine keeps, not the authored number that the
 * `enforced:` validator already reports.
 */
export function ruleCount(raw: string | undefined, whenAbsent = 0): number | null {
  const count = ruleInt(raw, whenAbsent);
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
 * One matched component of an `i`-suffixed composite as the int32 Godot stores (`vector2i.h:56-57`),
 * or `null` when no int32 holds it. Narrowed, so renderer and linter read one number. It takes a
 * capture the finite grammar matched: text from a file goes through {@link parseGodotInt}.
 */
export function storedInt(
  text: string | undefined,
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  const num = parseFloat(text ?? '');
  if (!Number.isFinite(num)) return null;
  const stored = storedFromFloat(num, text ?? '', 'int32', alwaysFloatBranch);
  return Number.isNaN(stored) ? null : stored;
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
  return captures.map((capture) =>
    asInt ? (storedInt(capture) ?? NaN) : readFloat(capture ?? '')
  );
}

/**
 * Whether the `i` spelling in a FLOAT slot narrows a component to a number the file does not state,
 * which a NaN from {@link slotComponents} cannot show. Same reader as {@link slotComponents}. A non-finite
 * one reads (`variant_parser.cpp:149-159`, `:577-586`) and narrows undefined outside int32 (`variant.h:369-370`),
 * and `4294967296` wraps. Neither is namable, so a caller reports the alteration (ADR-0032) and the literal.
 */
export function slotComponentsAltered(
  literal: string,
  /** The slot's own type name, such as `Vector2`, not the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[]
): boolean {
  if (!isConvertedSpelling(floatTypeName, compositeTypeName(literal))) return false;
  return captures.some((capture) => storedInt(capture) === null);
}
