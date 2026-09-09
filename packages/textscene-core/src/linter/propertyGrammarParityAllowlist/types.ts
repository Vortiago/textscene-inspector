/**
 * The shape of one allowlisted asymmetry.
 *
 * Split out from `propertyGrammarParityAllowlist.ts` so the family parts beside
 * this file can import it without importing the table they are merged into.
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
  reason: string;
}
