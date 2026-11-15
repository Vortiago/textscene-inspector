/** The caret width LineEdit and TextEdit draw: one rule for both painters. */
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

/**
 * `caret_width` times the theme's base scale, never below the authored width, cast to int
 * (`line_edit.cpp:1550`, `text_edit.cpp:1766`). LineEdit's minimum size reads the bare constant.
 */
export function caretDrawWidthPx(constants: SolveNode['constants'], baseScale: number): number {
  return Math.trunc(requiredThemeItem(constants, 'caret_width') * Math.max(1, baseScale));
}
