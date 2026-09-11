/**
 * `menuButtonMinimumSize`/`menuButtonTextTheme` vs Godot 4.6.3. Sizing shares
 * `button/nativeSolver.test.ts`'s worked example (`unitsPerEm=2048`,
 * `ascent=2189`, `descent=600`, 'A' hmtx advance 1354 design units,
 * `content_margin`=4 all sides — MenuButton's own StyleBoxes are the SAME
 * `button_normal`/`button_disabled` objects, `default_theme.cpp:255-258`).
 * The one dedicated case below is the genuine divergence: MenuButton's own
 * `font_disabled_color` literal, `Color(1, 1, 1, 0.3)` (`:268`), not Button's
 * `control_font_disabled_color` (`:161`).
 */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { MenuButtonProperties } from './types';
import { menuButtonMinimumSize, menuButtonTextTheme, MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR } from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const FONT_HEIGHT = 23;
const AB_WIDTH = (1354 + 1350) * (16 / 2048);
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22

function node(props: Partial<MenuButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'M',
    node: { name: 'M', type: 'MenuButton', children: [], properties: { name: 'M', ...props } as MenuButtonProperties },
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

function minSize(...args: Parameters<typeof menuButtonMinimumSize>): Vec2 {
  const result = menuButtonMinimumSize(...args);
  return 'size' in result ? result.size : result;
}

describe('menuButtonMinimumSize', () => {
  it('is exactly the default-theme button margin for empty text (8, 8)', () => {
    expect(minSize(node({}), ctx())).toEqual({ x: 8, y: 8 });
  });

  it('adds the measured text size on top of the margin, same math as Button', () => {
    const result = minSize(node({ text: 'AB' }), ctx());
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as text contributing nothing, margin alone still returns', () => {
    const noMeasurer: SolveContext = { ...ctx(), measureText: null };
    expect(minSize(node({ text: 'AB' }), noMeasurer)).toEqual({ x: 8, y: 8 });
  });
});

describe('menuButtonTextTheme', () => {
  it("resolves MenuButton's OWN disabled font colour, not Button's control_font_disabled_color", () => {
    const n = node({ disabled: true });
    const resolved = menuButtonTextTheme(n, n.node.properties as MenuButtonProperties, 'disabled', {
      theme: nativeTheme(1),
    });
    expect(resolved.color).toEqual(MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR);
  });

  it('honours a theme_override_colors/font_disabled_color override over the built-in literal', () => {
    const n = node({ disabled: true, themeOverrideColors: { font_disabled_color: { r: 0, g: 1, b: 0, a: 1 } } });
    const resolved = menuButtonTextTheme(n, n.node.properties as MenuButtonProperties, 'disabled', {
      theme: nativeTheme(1),
    });
    expect(resolved.color).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });
});
