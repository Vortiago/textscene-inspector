/**
 * Every default-theme box a Control solver builds for itself carries the corner detail of
 * `make_flat_stylebox` (`default_theme.cpp:65`): `MIN(ceil(1.5 * radius), 6) * scale`, truncated.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  controlNode,
  projectFontsAt,
  solveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { windowThemeDefaults } from '../../../windows/window/theme';
import { foldableContainerTitleShape } from '../foldablecontainer/nativeSolver';
import { graphEditMenuPanelStyleBox } from '../graphedit/toolbar';
import { graphEditDefaultPanel } from '../graphedit/defaultPanel';
import { graphFrameStyles } from '../graphframe/nativeSolver';
import { graphNodeStyles } from '../graphnode/nativeSolver';
import { pickItemListPanelStyleBox, pickItemListSelectedStyleBox } from '../itemlist/nativeSolver';
import { progressBarDefaultBackground, progressBarDefaultFill } from '../progressbar/nativeSolver';
import { pickTreePanelStyleBox } from '../tree/nativeSolver';

function plainNode(type: string): SolveNode {
  return { ...solveNode(), path: 'a', node: controlNode('a', type) };
}

describe.each([
  [1, 5, 6],
  [2, 10, 12],
])('default boxes at theme scale %i', (scale, radius3Detail, radius6Detail) => {
  const theme = nativeTheme(scale);

  it('gives GraphEdit, its toolbar, Tree and ItemList the detail of radius 3', () => {
    expect([
      graphEditDefaultPanel(theme).cornerDetail,
      graphEditMenuPanelStyleBox(theme).cornerDetail,
      pickTreePanelStyleBox({}, theme).cornerDetail,
      pickItemListPanelStyleBox({}, theme).cornerDetail,
      pickItemListSelectedStyleBox({}, theme).cornerDetail,
    ]).toEqual(Array(5).fill(radius3Detail));
  });

  it('gives GraphNode and GraphFrame panels the detail of radius 3 and their empty slots 1', () => {
    const node = graphNodeStyles(plainNode('GraphNode'), theme);
    const frame = graphFrameStyles(plainNode('GraphFrame'), theme);
    expect(
      [node.panel, node.titlebar, node.titlebarSelected, frame.panel, frame.panelSelected].map(
        (b) => b.cornerDetail
      )
    ).toEqual(Array(5).fill(radius3Detail));
    expect([node.slot.cornerDetail, frame.titlebar.cornerDetail]).toEqual([1, 1]);
  });

  it('gives the FoldableContainer title and panel the detail of radius 3', () => {
    const foldable = withThemeItems({
      ...plainNode('FoldableContainer'),
      projectFonts: projectFontsAt(scale),
    });
    const { titleStyle, panelStyle } = foldableContainerTitleShape(foldable, theme);
    expect([titleStyle.cornerDetail, panelStyle.cornerDetail]).toEqual([radius3Detail, radius3Detail]);
  });

  it('gives the embedded Window border the detail of radius 3', () => {
    const { embeddedBorder, embeddedUnfocusedBorder } = windowThemeDefaults(theme);
    expect([embeddedBorder.cornerDetail, embeddedUnfocusedBorder.cornerDetail]).toEqual([
      radius3Detail,
      radius3Detail,
    ]);
  });

  it('gives the ProgressBar boxes the detail of radius 6', () => {
    expect([
      progressBarDefaultBackground(theme).cornerDetail,
      progressBarDefaultFill(theme).cornerDetail,
    ]).toEqual([radius6Detail, radius6Detail]);
  });
});
