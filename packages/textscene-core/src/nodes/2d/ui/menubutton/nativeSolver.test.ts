/**
 * Tests `menuButtonMinimumSize` and the MenuButton text theme against Godot 4.6.3. Sizing reuses
 * `button/nativeSolver.test.ts`'s example, since MenuButton's StyleBoxes are Button's objects
 * (`default_theme.cpp:255-258`). The dedicated case is MenuButton's `font_disabled_color`,
 * `Color(1, 1, 1, 0.3)` (`:268`), not Button's `control_font_disabled_color` (`:161`).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { MenuButtonProperties } from './types';
import { buttonTextTheme } from '../button/nativeSolver';
import { menuButtonMinimumSize } from './nativeSolver';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';

const FONT_HEIGHT = 23;
const AB_WIDTH = (1354 + 1350) * (16 / 2048);
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22

function node(props: Partial<MenuButtonProperties>): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'M',
    node: controlNode('M', 'MenuButton', { name: 'M', ...props }),
    // A local theme_override_colors/* reaches `resolveTextTheme` through `n.colors`, which the walker
    // fills unconditionally, not through props.
    colors: props.themeOverrideColors ?? {},
  });
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

const minSize = menuButtonMinimumSize;

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

describe('the text theme of a MenuButton', () => {
  const disabledTextTheme = (n: SolveNode) =>
    buttonTextTheme(n, n.node.properties as MenuButtonProperties, 'disabled', { theme: nativeTheme(1) });

  it("resolves MenuButton's OWN disabled font colour, not Button's control_font_disabled_color", () => {
    const n = node({ disabled: true });
    const resolved = disabledTextTheme(n);
    // default_theme.cpp:268 sets MenuButton's own Color(1, 1, 1, 0.3).
    expect(resolved.color).toEqual({ r: 1, g: 1, b: 1, a: 0.3 });
  });

  it('honours a theme_override_colors/font_disabled_color override over the default theme', () => {
    const n = node({
      disabled: true,
      themeOverrideColors: { font_disabled_color: { r: 0, g: 1, b: 0, a: 1 } },
    });
    const resolved = disabledTextTheme(n);
    expect(resolved.color).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });
});

describe('menuButtonMinimumSize — clip_text zeroes the text width (button.cpp:493-495)', () => {
  it('keeps the margin and the text height, and drops the text width', () => {
    expect(minSize(node({ text: 'AB', clipText: true }), ctx())).toEqual({ x: 8, y: 8 + FONT_HEIGHT });
  });

  it('keeps the whole text width without clip_text', () => {
    expect(minSize(node({ text: 'AB', clipText: false }), ctx()).x).toBe(8 + AB_SHAPED_WIDTH);
  });
});
