/**
 * The shape of one allowlisted asymmetry.
 *
 * Split out from `propertyGrammarParityAllowlist.ts` so the family parts beside
 * this file can import it without importing the table they are merged into. The
 * three key kinds and why they are three are explained where the table is
 * assembled.
 */

export interface AsymmetryEntry {
  parserOnly?: readonly string[];
  /**
   * Validated but not read, BY DESIGN: the property cannot change a frozen
   * frame, so there is nothing for a parser to do with it. Focus order, mouse
   * filtering, context menus, threading, clipboard behaviour.
   */
  linterOnly?: readonly string[];
  /**
   * Validated but not read, and it SHOULD be: the property does change a frozen
   * frame and the renderer simply does not implement it yet.
   *
   * Split out from `linterOnly` because collapsing the two is how a parser bug
   * hides. `OptionButton`'s `item_*` keys sat in a "limitations" list reading
   * like deliberate scope while the real cause was `parseOptionButton` chaining
   * `parseControl` instead of `parseButton` and dropping six lines. A reviewer
   * scanning one undifferentiated list has no way to tell "we decided not to"
   * from "this is broken".
   *
   * The stale check below is the payoff: the day someone renders one of these,
   * the guard fails until the key is removed, so the list can only shrink by
   * the gap actually closing.
   */
  renderGap?: readonly string[];
  /**
   * Validated under a pre-4.0 spelling, and read by the parser under the
   * modern one: `canonicalPropertyName` (`godot/deprecated.ts`) rewrites the
   * key in the property bag before the parser sees it, so this scan looks for
   * a key nothing downstream ever holds.
   *
   * Neither of the two above fits, and using either lies. `linterOnly` claims
   * the property cannot change a frozen frame — false for `frames`, `navpoly`
   * and `align`, which all change the picture. `renderGap` claims the renderer
   * does not implement it — also false, since it honours the value under its
   * current name.
   *
   * Self-verifying: `isDeprecatedPropertyName` has to agree that the key is an
   * alias on this type, so a key that merely goes unread cannot be parked here.
   */
  aliasedRead?: readonly string[];
  reason: string;
}
