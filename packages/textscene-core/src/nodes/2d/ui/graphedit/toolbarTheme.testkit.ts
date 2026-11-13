/** A `GraphEdit` solve node under one Theme, with the default theme's GraphEdit items, for tests of the toolbar's theme items. */
import type { TscnInternalResource } from '../../../../parser/types';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';

function boxOfMargin(id: string, margin: number): TscnInternalResource {
  const m = `${margin}.0`;
  return {
    id,
    type: 'StyleBoxFlat',
    data: {
      content_margin_left: m,
      content_margin_top: m,
      content_margin_right: m,
      content_margin_bottom: m,
      bg_color: 'Color(0.5, 0.5, 0.5, 1)',
    },
  };
}

/** A GraphEdit under one Theme with `styles` (type, then item, to a box of the given margin) and `colors`. */
export function graphEditUnder(
  styles: Record<string, Record<string, number>> = {},
  colors: ThemeResource['colors'] = {},
  typeVariations: Record<string, string> = {}
): SolveNode {
  const resources = Object.entries(styles).flatMap(([type, items]) =>
    Object.entries(items).map(([item, margin]) => boxOfMargin(`${type}_${item}`, margin))
  );
  const refs = Object.fromEntries(
    Object.entries(styles).map(([type, items]) => [
      type,
      Object.fromEntries(Object.keys(items).map((item) => [item, `SubResource("${type}_${item}")`])),
    ])
  );
  const theme: ThemeResource = {
    ...themeResource({ typeVariations }),
    styles: refs,
    colors,
    resources: { externalResources: [], internalResources: resources },
  };
  return withThemeItems({
    ...solveNode(),
    path: 'G',
    node: controlNode('G', 'GraphEdit'),
    themeChain: [theme],
  });
}
