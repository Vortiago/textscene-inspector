/**
 * Where a ScrollBar's StyleBoxes come from: a standalone bar reads its own items, and a Control that
 * `memnew`s its bars (ItemList, TextEdit, ScrollContainer and others) reads them through its own
 * Theme chain, as an internal child does (`Control::get_theme_stylebox`, `control.cpp:3078`).
 */
import { internalChildThemeItems, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ScrollBarBoxes, ScrollBarPairBoxes } from './scrollBarSolver';

/** The `scroll` and `grabber` boxes of one bar's resolved StyleBoxes. */
export function scrollBarBoxes(styleBoxes: SolveNode['styleBoxes']): ScrollBarBoxes {
  return {
    scroll: requiredThemeItem(styleBoxes, 'scroll'),
    grabber: requiredThemeItem(styleBoxes, 'grabber'),
  };
}

/** The boxes of the HScrollBar and VScrollBar that `host` creates inside itself. */
export function internalScrollBarBoxes(host: SolveNode): ScrollBarPairBoxes {
  return {
    horizontal: scrollBarBoxes(internalChildThemeItems(host, 'HScrollBar').styleBoxes),
    vertical: scrollBarBoxes(internalChildThemeItems(host, 'VScrollBar').styleBoxes),
  };
}
