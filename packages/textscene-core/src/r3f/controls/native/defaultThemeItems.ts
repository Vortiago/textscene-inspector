/**
 * The `panel` a Panel or PanelContainer draws where no theme sets one. React-free: the items are plain data.
 */

import { buildThemeTypeChain } from '../../../resources/styles/theme/lookup';
import { perObject } from '../../../utils/perObject';
import type { ShareNode, SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';

/** Written only by `typeChains`. A node is replaced when the scene changes, so its chain resolves once. */
const typeChains = perObject((n: ShareNode): readonly string[] =>
  buildThemeTypeChain(
    n.node.type,
    (n.node.properties as ControlProperties).themeTypeVariation,
    n.themeChain,
    n.projectFonts.projectTheme
  )
);

/** The `panel` of a Panel or PanelContainer: the scene's, else `TooltipPanel`'s where the variation names it, else `Panel`'s. */
export function panelBoxOf(n: SolveNode, theme: NativeTheme): StyleBoxFlatData {
  const given = n.styleBoxes.panel;
  if (given) return given;
  return typeChains(n).includes('TooltipPanel') ? theme.widgets.tooltipPanel : theme.widgets.panel;
}
