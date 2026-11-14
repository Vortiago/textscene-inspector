/** The titlebar a GraphNode or GraphFrame builds (`graph_node.cpp:1322-1334`, `graph_frame.cpp:348-360`). */
import { describe, expect, it } from 'vitest';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { SizeFlags } from '../../../../godot/scene/control';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import type { LabelProperties } from '../label/types';
import type { ControlProperties } from '../control/types';
import { titlebarHeights, titlebarMinimumSize } from './graphTitlebar';
import '../../../../parser/TscnParser';
import '../../../../r3f/controls/index';

const THEME = nativeTheme(1);
const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

type ElementType = 'GraphNode' | 'GraphFrame';

function element(type: ElementType, props: Record<string, unknown> = {}, theme?: ThemeResource): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'E',
    node: controlNode('E', type, { name: 'E', title: 'Title', ...props }),
    themeChain: theme ? [theme] : [],
  });
}

function hbox(n: SolveNode): SolveNode {
  const [front, ...rest] = internalControlsOf(n, THEME);
  expect(rest).toEqual([]);
  expect(front!.mode).toBe('front');
  return front!.node;
}

const titleLabel = (n: SolveNode) => hbox(n).children[0]!;
const labelProps = (n: SolveNode) => titleLabel(n).node.properties as LabelProperties;
const fontColour = (n: SolveNode) => titleLabel(n).colors.font_color;

describe('the titlebar a GraphElement builds', () => {
  it.each(['GraphNode', 'GraphFrame'] as const)(
    'adds titlebar_hbox, an expanding HBoxContainer that holds title_label (%s)',
    (type) => {
      const box = hbox(element(type));
      expect([box.node.type, box.path]).toEqual(['HBoxContainer', 'E/@titlebar_hbox']);
      expect((box.node.properties as ControlProperties).sizeFlagsHorizontal).toBe(
        SizeFlags.EXPAND | SizeFlags.FILL
      );
      expect(box.children.map((c) => [c.node.type, c.node.name])).toEqual([['Label', 'title_label']]);
    }
  );

  it('writes the title into the Label (set_title)', () => {
    expect(labelProps(element('GraphNode', { title: 'Mix' })).text).toBe('Mix');
  });

  it('gives each class its variation, and centres only the frame title (graph_frame.cpp:356)', () => {
    const node = labelProps(element('GraphNode'));
    const frame = labelProps(element('GraphFrame'));
    expect([node.themeTypeVariation, node.horizontalAlignment ?? 0]).toEqual(['GraphNodeTitleLabel', 0]);
    expect([frame.themeTypeVariation, frame.horizontalAlignment]).toEqual([
      'GraphFrameTitleLabel',
      HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
    ]);
  });
});

describe('the title colour through the Theme chain', () => {
  it('keeps the default theme colour without a Theme: control_font_color for a node, white for a frame', () => {
    expect(fontColour(element('GraphNode'))).toEqual(CONTROL_FONT_COLOR);
    expect(fontColour(element('GraphFrame'))).toEqual(WHITE);
  });

  it('reads font_color of Label from an ancestor Theme, since the variation is a Label', () => {
    const theme = themeResource({ colors: { Label: { font_color: RED } } });
    expect(fontColour(element('GraphNode', {}, theme))).toEqual(RED);
  });

  it('prefers font_color of the title variation to the one of Label', () => {
    const theme = themeResource({
      colors: { Label: { font_color: RED }, GraphNodeTitleLabel: { font_color: GREEN } },
    });
    expect(fontColour(element('GraphNode', {}, theme))).toEqual(GREEN);
  });

  it('does not read the colour of another class', () => {
    const theme = themeResource({ colors: { Button: { font_color: RED } } });
    expect(fontColour(element('GraphFrame', {}, theme))).toEqual(WHITE);
  });
});

describe('the titlebar size', () => {
  const ctx = () => createSolveContext(THEME, measureText);
  const boxedTheme = (): ThemeResource => ({
    ...themeResource(),
    styles: { Label: { normal: 'SubResource("box")' } },
    resources: {
      externalResources: [],
      internalResources: [
        {
          id: 'box',
          type: 'StyleBoxFlat',
          data: {
            content_margin_left: '10',
            content_margin_top: '6',
            content_margin_right: '14',
            content_margin_bottom: '4',
          },
        },
      ],
    },
  });

  it.each(['Title', ''])(
    'takes the margins of the Label normal box into its minimum size ("%s")',
    (title) => {
      const plain = titlebarMinimumSize(element('GraphNode', { title }), ctx());
      const themed = titlebarMinimumSize(element('GraphNode', { title }, boxedTheme()), ctx());
      expect(themed).toEqual({ x: plain.x + 24, y: plain.y + 10 });
    }
  );

  it('draws the band at its minimum height, and lays the body out below it in whole pixels (Size2i, graph_node.cpp:165)', () => {
    const n = element('GraphNode');
    const { resort, drawn } = titlebarHeights(n, ctx());
    expect(drawn).toBe(titlebarMinimumSize(n, ctx()).y);
    expect(resort).toBe(Math.trunc(drawn));
  });
});

describe('where the titlebar sits', () => {
  /** A titlebar box with different side margins, so a mirrored offset shows. */
  const MARGINS = { left: 3, top: 4, right: 9, bottom: 4 };

  function solvedHbox(rtl: boolean) {
    const plain = element('GraphNode', { offsetRight: 300, offsetBottom: 200 });
    const titlebar = { ...plain.styleBoxes.titlebar!, contentMargin: MARGINS };
    const n = { ...plain, rtl, styleBoxes: { ...plain.styleBoxes, titlebar } };
    const solved = solveControlTree(
      [n],
      { x: 0, y: 0, w: 600, h: 400 },
      createSolveContext(THEME, measureText)
    );
    return solved.get(hbox(n).path)!.rect;
  }

  it('places titlebar_hbox at the titlebar box offset, across the width less its margins (:159-162)', () => {
    const rect = solvedHbox(false);
    expect([rect.x, rect.y, rect.w]).toEqual([3, 4, 300 - 3 - 9]);
  });

  it('keeps the offset in a right-to-left layout: set_rect writes mirrored offsets (control.cpp:904-915)', () => {
    expect(solvedHbox(true).x).toBe(3);
  });
});
