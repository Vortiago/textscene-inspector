/**
 * Tests `menuBarMinimumSize` against Godot 4.6.3 (`scene/gui/menu_bar.cpp:865-886`) with the hand-derived
 * OpenSans_SemiBold example of `button/nativeSolver.test.ts`: font height 23, 'A' 11. MenuBar registers
 * Button's `button_normal` box and `Math::round(4 * scale)` `h_separation` (`default_theme.cpp:176-194`,
 * `:145-172`), so margins are 4 and one title is (8+11, 8+23) = (19, 31).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { MenuBarProperties } from './types';
import { layoutMenuBarItems, menuBarMinimumSize, menuBarTitleShapes, type MenuBarTitle } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const MARGIN = 8; // content_margin 4, both sides.
const FONT_HEIGHT = 23;
const A_WIDTH = 11; // ceil(1354 * 16 / 2048)
const H_SEPARATION = 4;

function popup(name: string, title?: string): TscnNode {
  return {
    name,
    type: 'PopupMenu',
    children: [],
    properties: {},
    rawProperties: title !== undefined ? { title: `"${title}"` } : {},
  };
}

function node(children: TscnNode[]): SolveNode {
  return {
    ...solveNode(),
    path: 'Bar',
    node: {
      name: 'Bar',
      type: 'MenuBar',
      children,
      properties: { name: 'Bar' } as MenuBarProperties,
    },
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

const minSize = menuBarMinimumSize;

describe('menuBarMinimumSize', () => {
  it('sizes a single title from its own name, no h_separation added for one item', () => {
    expect(minSize(node([popup('A')]), ctx())).toEqual({ x: MARGIN + A_WIDTH, y: MARGIN + FONT_HEIGHT });
  });

  it('sums two titles plus one h_separation, height is the max of the two', () => {
    expect(minSize(node([popup('A'), popup('A')]), ctx())).toEqual({
      x: (MARGIN + A_WIDTH) * 2 + H_SEPARATION,
      y: MARGIN + FONT_HEIGHT,
    });
  });

  it('prefers the PopupMenu child\'s own `title` over its node name', () => {
    const titles = menuBarTitleShapes(node([popup('SomeInternalName', 'A')]), nativeTheme(1));
    expect(titles[0]?.layout.widthPx).toBeCloseTo(1354 * (16 / 2048), 6);
  });

  it('ignores a non-PopupMenu child entirely', () => {
    const stray: TscnNode = { name: 'X', type: 'Label', children: [], properties: {} };
    expect(minSize(node([stray]), ctx())).toEqual({ x: 0, y: 0 });
  });

  it('is (0, 0) with no PopupMenu children at all', () => {
    expect(minSize(node([]), ctx())).toEqual({ x: 0, y: 0 });
  });

  it('treats an absent measurer as each title contributing margin only, not the whole size collapsing', () => {
    expect(minSize(node([popup('A'), popup('B')]), ctx(false))).toEqual({
      x: MARGIN * 2 + H_SEPARATION,
      y: MARGIN,
    });
  });
});

describe('layoutMenuBarItems', () => {
  const titles = [
    { name: 'File', layout: null, size: { x: 60, y: 31 } },
    { name: 'Edit', layout: null, size: { x: 100, y: 31 } },
    { name: 'Help', layout: null, size: { x: 40, y: 31 } },
  ] as unknown as MenuBarTitle[];

  it('walks left to right from 0, one h_separation between items (menu_bar.cpp:412-420)', () => {
    const items = layoutMenuBarItems(titles, H_SEPARATION, 400, false);
    expect(items.map((i) => i.x)).toEqual([0, 64, 168]);
  });

  it('mirrors each item inside the bar under RTL: size.x - offset - size.x (menu_bar.cpp:424)', () => {
    const items = layoutMenuBarItems(titles, H_SEPARATION, 400, true);
    expect(items.map((i) => i.x)).toEqual([400 - 0 - 60, 400 - 64 - 100, 400 - 168 - 40]);
  });

  it('keeps the first item against the trailing edge whatever the bar width', () => {
    expect(layoutMenuBarItems(titles, H_SEPARATION, 700, true)[0]!.x).toBe(640);
  });
});
