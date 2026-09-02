/**
 * Integer readers for rules and for the components of an `i`-suffixed
 * composite in a float slot. See `int.ts` for the whole picture.
 */

import { matchedFloat } from './number.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';
import type { IntWidth } from './intWidth.js';
import { parseGodotInt, storedFromFloat } from './intReader.js';

/**
 * The int a RULE may compare, or `null` for anything it must not.
 *
 * `parseGodotInt`'s `NaN` is a signal for the VALIDATOR layer, which turns it
 * into a diagnostic. A rule that lets it through drops out of every comparison
 * instead — `frame >= NaN` is false — so the rule goes silent on exactly the
 * scene that needed it. Phase 1 already reports the unstorable value, so
 * silence is what a rule owes; `null` is how it says so.
 *
 * `whenAbsent` is the value a MISSING key stands for, for the many rules where
 * Godot's default is not zero (`hframes` is 1).
 *
 * Here rather than beside the validators because two RENDER decoders read it —
 * `gridmap/cellData.ts` and `tiles/shared/tileData.ts`, both on the webview
 * path — and reaching into `linter/validators/` for it pulled the diagnostic
 * machinery after them, which is the coupling `src/godot/` exists to avoid.
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
 * The array COUNT a rule may compare against, or `null` for text it must not.
 *
 * Every serialised array count in Godot opens its setter with
 * `ERR_FAIL_COND(p_count < 0)` — `ItemList` (item_list.cpp:527), `PopupMenu`
 * (popup_menu.cpp:2698), `FileDialog` (file_dialog.cpp:2039), `TabBar`
 * (tab_bar.cpp:745), `OptionButton` (option_button.cpp:310), `MenuButton`
 * (menu_button.cpp:124), and the skeleton modifiers through
 * `_set_setting_count` (ik_modifier_3d.h:98). The write is refused outright, so
 * the array keeps the length it already had — at load, the class default.
 *
 * A rule that compares indices against the AUTHORED number instead names a
 * length the engine never stored, and does it beside the `enforced:` validator
 * that already reported the same value.
 */
export function ruleCount(raw: string | undefined, whenAbsent = 0): number | null {
  const count = ruleInt(raw, whenAbsent);
  // `null` still means unreadable, and still travels: phase 1 has already
  // reported that text, and a rule owes silence rather than a second
  // diagnostic naming a number it had to invent.
  if (count === null) return null;
  return count < 0 ? whenAbsent : count;
}

/**
 * One matched component of an `i`-suffixed composite, as the integer Godot
 * stores — or `null` when no int32 can hold it.
 *
 * NARROWED, like every other reader here. `Vector2i`/`Vector3i`/`Vector4i`/
 * `Rect2i` components are all `int32_t` (`vector2i.h:56-57`), and skipping the
 * narrowing put the renderer and the linter on different numbers for the same
 * text: the linter read `z_index = 4294967295` as -1 and said nothing, while
 * the previewer placed the node at z = 4.29e8, behind the camera.
 *
 * Takes a capture the finite grammar ALREADY matched, so the READ is a bare
 * `parseFloat`; text straight from a file goes through {@link parseGodotInt}.
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
 * The matched components of a composite in a FLOAT-typed slot, each read the
 * way the SPELLING stores it.
 *
 * `slotTupleRegex` admits the `i`-suffixed spelling because
 * `can_convert_strict` converts it, but the two spellings do not store the same
 * numbers. `Vector2i(...)` arguments go through `_parse_construct<int32_t>`
 * (`variant_parser.cpp:721-733`), so each is narrowed to int32 BEFORE the
 * widening into the float slot runs: `Vector2i(4294967295, 0)` reaches a
 * `Vector2` slot as `(-1, 0)`, and `Vector2i(1.5, 0)` as `(1, 0)`. Reading
 * those captures as plain floats placed the node 4.29e9 units away.
 *
 * An unstorable component comes back NaN, so the caller's existing `allFinite`
 * check takes the warn-then-fall-back path it already has for a literal the
 * grammar refuses.
 */
export function slotComponents(
  literal: string,
  /** The slot's own type name, e.g. `Vector2` — NOT the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[],
  /**
   * How a component of the FLOAT spelling reads, for the grammar the caller
   * matched with. `slotTupleRegex` is finite-only, so `matchedFloat` is the
   * default; the linter's `makeFloatTupleRegex` also admits `inf`/`nan`, and
   * `parseFloat` answers NaN for all four of those spellings — which would turn
   * every comparison against a legal `inf` component false.
   *
   * It settles the FLOAT branch only. `_parse_construct<int32_t>` takes a
   * non-finite argument as readily as a finite one — `stor_fix`
   * (`variant_parser.cpp:149-159`) answers the identifiers `inf`/`-inf`/
   * `inf_neg`/`nan` with a double, and the branch calling it (`:577-586`) is the
   * one every constructor runs — so NaN in the result means either a legal
   * non-finite float component or an int component the engine altered. A caller
   * that must tell those apart asks {@link slotComponentsAltered}.
   */
  readFloat: (text: string) => number = matchedFloat
): number[] {
  const asInt = isConvertedSpelling(floatTypeName, compositeTypeName(literal));
  return captures.map((capture) =>
    asInt ? (storedInt(capture) ?? NaN) : readFloat(capture ?? '')
  );
}

/**
 * Whether the `i`-suffixed spelling in a FLOAT slot narrows a component to a
 * number the file does not state.
 *
 * The third state {@link slotComponents} has no room for. Its NaN says only "do
 * not compare this", and a legal `Vector3(nan, 0, 0)` answers to it exactly as
 * an altered `Vector3i(inf, 0, 0)` does — so a bound reading the array alone
 * stays silent on the one that IS a defect, since every comparison against NaN
 * is false either way.
 *
 * True only for the converted spelling, and for two kinds of component. A
 * non-finite one reads (`variant_parser.cpp:149-159`, `:577-586`) and is then
 * narrowed by `_to_int<int32_t>`, undefined behaviour outside int32's range
 * (`variant.h:369-370`). One past int32's round-tripping band — `4294967296` —
 * reads as an INT variant and wraps to a value nothing writes. Either way the
 * engine stores a number the file does not name, which is the alteration
 * ADR-0032 puts at the error tier, and neither number is namable: the first is
 * architecture-specific, the second is the wrap this module refuses to invent.
 * So a caller reports the ALTERATION and quotes the literal.
 *
 * Same reader as {@link slotComponents}, on the same captures, so the pair
 * cannot answer differently about one component.
 */
export function slotComponentsAltered(
  literal: string,
  /** The slot's own type name, e.g. `Vector2` — NOT the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[]
): boolean {
  if (!isConvertedSpelling(floatTypeName, compositeTypeName(literal))) return false;
  return captures.some((capture) => storedInt(capture) === null);
}
