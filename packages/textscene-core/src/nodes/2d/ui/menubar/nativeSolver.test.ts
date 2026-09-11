/**
 * `menuBarMinimumSize` vs Godot 4.6.3 (`MenuBar::get_minimum_size`,
 * `scene/gui/menu_bar.cpp:865-886`). Expected numbers reuse the same worked
 * OpenSans_SemiBold example `button/nativeSolver.test.ts` derives
 * (`unitsPerEm=2048`, `ascent=2189`, `descent=600`; 'A' hmtx advance = 1354
 * design units) and the default theme's Button margin MenuBar shares byte-
 * for-byte (`default_theme.cpp:176-194` registers the SAME `button_normal`
 * StyleBox and the SAME `Math::round(4 * scale)` literal for `h_separation`
 * as Button's own section, `:145-172`) — an independent worked example, never
 * the implementation's own output.
 *
 * At font size 16, `font->get_height()` = ascent + descent = 23
 * (`ceil(2189*16/2048)=18`, `ceil(600*16/2048)=5`). 'A' shaped width =
 * `ceil(1354*16/2048)` = `ceil(10.578125)` = 11. `content_margin` = 4 all
 * sides at scale 1, so one title's own item size is `(8+11, 8+23)` =
 * `(19, 31)`. `h_separation` = `round(4*1)` = 4.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { MenuBarProperties } from './types';
import { menuBarMinimumSize, type MenuBarTitle } from './nativeSolver';
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

function minSize(...args: Parameters<typeof menuBarMinimumSize>): Vec2 {
  const result = menuBarMinimumSize(...args);
  return 'size' in result ? result.size : result;
}

function minMeta(...args: Parameters<typeof menuBarMinimumSize>): MenuBarTitle[] | undefined {
  const result = menuBarMinimumSize(...args);
  return 'meta' in result ? (result.meta as MenuBarTitle[] | undefined) : undefined;
}

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
    const meta = minMeta(node([popup('SomeInternalName', 'A')]), ctx());
    expect(meta?.[0]?.layout.widthPx).toBeCloseTo(1354 * (16 / 2048), 6);
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
