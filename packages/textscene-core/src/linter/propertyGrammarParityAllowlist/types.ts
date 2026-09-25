/**
 * The shape of one allowlisted asymmetry. It has its own file so the family
 * parts can import it without importing the table they merge into.
 */

export interface AsymmetryEntry {
  /** Read for rendering, with no validator: the linter has nothing to check. */
  parserOnly?: readonly string[];
  /**
   * Validated but not read, by design: the property cannot change a frozen
   * frame. Focus order, mouse filtering, context menus, threading, clipboard.
   */
  linterOnly?: readonly string[];
  /**
   * Validated but not read, and it should be: the property changes a frozen
   * frame and the renderer does not implement it yet. It is apart from
   * `linterOnly` so a parser bug cannot pass as deliberate scope, and the
   * stale check fails once a key renders, so the list shrinks only as gaps close.
   */
  renderGap?: readonly string[];
  reason: string;
}
