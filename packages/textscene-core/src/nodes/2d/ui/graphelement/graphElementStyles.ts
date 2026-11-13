/**
 * The four boxes GraphNode and GraphFrame both draw their chrome with: the body panel and the titlebar,
 * each with a selected variant (`graph_node.cpp:1306-1310`, `graph_frame.cpp:202-205`).
 */
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

export function graphElementStyles(n: SolveNode) {
  const boxes = n.styleBoxes;
  return {
    panel: requiredThemeItem(boxes, 'panel'),
    panelSelected: requiredThemeItem(boxes, 'panel_selected'),
    titlebar: requiredThemeItem(boxes, 'titlebar'),
    titlebarSelected: requiredThemeItem(boxes, 'titlebar_selected'),
  };
}
