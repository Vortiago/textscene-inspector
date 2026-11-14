/**
 * Where a ScrollBar's StyleBoxes come from: a standalone bar reads its own items, and a Control that
 * `memnew`s its bars (ItemList, TextEdit, ScrollContainer and others) reads them through its own
 * Theme chain, as an internal child does (`Control::get_theme_stylebox`, `control.cpp:3078`).
 */
import { themeItemsOfType, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { perObject } from '../../../../utils/perObject';
import type { ScrollBarBoxes, ScrollBarPairBoxes } from './scrollBarSolver';

/**
 * The `scroll` and `grabber` boxes of one bar's resolved StyleBoxes. Cached per record, so a memo
 * that lists the boxes as a dependency keeps them across renders.
 */
export const scrollBarBoxes = perObject((styleBoxes: SolveNode['styleBoxes']): ScrollBarBoxes => ({
  scroll: requiredThemeItem(styleBoxes, 'scroll'),
  grabber: requiredThemeItem(styleBoxes, 'grabber'),
}));

/** The boxes of the HScrollBar and VScrollBar that `host` creates inside itself, cached per host. */
export const internalScrollBarBoxes = perObject((host: SolveNode): ScrollBarPairBoxes => ({
  horizontal: scrollBarBoxes(themeItemsOfType(host, 'HScrollBar').styleBoxes),
  vertical: scrollBarBoxes(themeItemsOfType(host, 'VScrollBar').styleBoxes),
}));
