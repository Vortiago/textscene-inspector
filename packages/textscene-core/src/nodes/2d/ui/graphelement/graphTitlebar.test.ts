/** The title Label of a GraphNode or GraphFrame reads its font colour through the Theme chain (`graph_node.cpp`, `graph_frame.cpp` title_label). */
import { describe, expect, it } from 'vitest';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { resolveTitleFontTheme, titleTextMinimumSize } from './graphTitlebar';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function underTheme(colors: Record<string, Record<string, typeof RED>>) {
  const theme: ThemeResource = themeResource({ colors });
  return { ...solveNode(), path: 'N', node: controlNode('N', 'GraphNode'), themeChain: [theme] };
}

describe('resolveTitleFontTheme colour', () => {
  it('keeps the default theme colour without a Theme: control_font_color for a node, white for a frame', () => {
    expect(resolveTitleFontTheme(underTheme({}), 'GraphNodeTitleLabel', 16).color).toEqual(
      CONTROL_FONT_COLOR
    );
    expect(resolveTitleFontTheme(underTheme({}), 'GraphFrameTitleLabel', 16).color).toEqual(WHITE);
  });

  it('reads font_color of Label from an ancestor Theme, since the variation is a Label', () => {
    const n = underTheme({ Label: { font_color: RED } });
    expect(resolveTitleFontTheme(n, 'GraphNodeTitleLabel', 16).color).toEqual(RED);
  });

  it('prefers font_color of the title variation to the one of Label', () => {
    const n = underTheme({ Label: { font_color: RED }, GraphNodeTitleLabel: { font_color: GREEN } });
    expect(resolveTitleFontTheme(n, 'GraphNodeTitleLabel', 16).color).toEqual(GREEN);
  });

  it('does not read the colour of another class', () => {
    const n = underTheme({ Button: { font_color: RED } });
    expect(resolveTitleFontTheme(n, 'GraphFrameTitleLabel', 16).color).toEqual(WHITE);
  });
});

describe('the title Label with a Theme normal box (label.cpp:983-996)', () => {
  const box = {
    id: 'box',
    type: 'StyleBoxFlat',
    data: {
      content_margin_left: '10',
      content_margin_top: '6',
      content_margin_right: '14',
      content_margin_bottom: '4',
    },
  };
  const boxed = () => {
    const theme: ThemeResource = {
      ...themeResource(),
      styles: { Label: { normal: 'SubResource("box")' } },
      resources: { externalResources: [], internalResources: [box] },
    };
    return { ...solveNode(), path: 'N', node: controlNode('N', 'GraphNode'), themeChain: [theme] };
  };

  it('takes the margins of the box into its minimum size', () => {
    const plain = titleTextMinimumSize(
      'AB',
      resolveTitleFontTheme(underTheme({}), 'GraphNodeTitleLabel', 16)
    );
    const themed = titleTextMinimumSize('AB', resolveTitleFontTheme(boxed(), 'GraphNodeTitleLabel', 16));
    expect(themed).toEqual({ x: plain.x + 24, y: plain.y + 10 });
  });

  it('takes the margins of the box into the minimum size of an empty title', () => {
    const plain = titleTextMinimumSize('', resolveTitleFontTheme(underTheme({}), 'GraphNodeTitleLabel', 16));
    const themed = titleTextMinimumSize('', resolveTitleFontTheme(boxed(), 'GraphNodeTitleLabel', 16));
    expect(themed).toEqual({ x: plain.x + 24, y: plain.y + 10 });
  });
});
