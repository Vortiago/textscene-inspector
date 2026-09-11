/** Tree's draw-time geometry vs `scene/gui/tree.cpp` (Godot 4.6.3), restricted to the always-empty case (`nativeSolver.ts`'s own doc). */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  treePanelStyleBox,
  pickTreePanelStyleBox,
  pickTreeTitleButtonStyleBox,
  treeTitleButtonHeightPx,
  treeContentRect,
  treeColumnWidthPx,
} from './nativeSolver';

const THEME = nativeTheme(1);

describe('treePanelStyleBox', () => {
  // default_theme.cpp:860: make_flat_stylebox(style_normal_color, 4, 4, 4, 5).
  it('has a taller bottom margin than its other three sides', () => {
    const box = treePanelStyleBox(THEME);
    expect(box.contentMargin.left).toBe(4);
    expect(box.contentMargin.top).toBe(4);
    expect(box.contentMargin.right).toBe(4);
    expect(box.contentMargin.bottom).toBe(5);
  });
  it('fills with style_normal_color (alpha 0.6)', () => {
    expect(treePanelStyleBox(THEME).bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
  });
});

describe('pickTreePanelStyleBox / pickTreeTitleButtonStyleBox', () => {
  it('falls back to the computed defaults when no override is present', () => {
    expect(pickTreePanelStyleBox({}, THEME)).toEqual(treePanelStyleBox(THEME));
    expect(pickTreeTitleButtonStyleBox({}, THEME)).toBe(THEME.widgets.button.pressed);
  });
  it('prefers a theme_override_styles override over the default', () => {
    const override = treePanelStyleBox(THEME);
    expect(pickTreePanelStyleBox({ panel: override }, THEME)).toBe(override);
  });
});

describe('treeTitleButtonHeightPx', () => {
  it('is zero when column_titles_visible is unset', () => {
    expect(treeTitleButtonHeightPx(undefined, THEME.widgets.button.pressed)).toBe(0);
  });
  it("is the title button's own content-margin height when visible, even with a blank title", () => {
    const box = THEME.widgets.button.pressed;
    expect(treeTitleButtonHeightPx(true, box)).toBe(box.contentMargin.top + box.contentMargin.bottom);
  });
});

describe('treeContentRect', () => {
  it("insets the rect by the panel stylebox's own margins", () => {
    const box = treePanelStyleBox(THEME);
    const rect = treeContentRect({ x: 200, y: 100 }, box);
    expect(rect).toEqual({
      x: box.contentMargin.left,
      y: box.contentMargin.top,
      w: 200 - box.contentMargin.left - box.contentMargin.right,
      h: 100 - box.contentMargin.top - box.contentMargin.bottom,
    });
  });
  it('floors at zero extent rather than going negative for a rect smaller than the margins', () => {
    const box = treePanelStyleBox(THEME);
    const rect = treeContentRect({ x: 1, y: 1 }, box);
    expect(rect.w).toBe(0);
    expect(rect.h).toBe(0);
  });
});

describe('treeColumnWidthPx', () => {
  it('splits the content width evenly across columns when titles are hidden (zero minimum each)', () => {
    const box = THEME.widgets.button.pressed;
    expect(treeColumnWidthPx(300, 3, false, box)).toBe(100);
  });
  it("floors each column at the title button's own L+R margin once titles are visible", () => {
    const box = THEME.widgets.button.pressed;
    const width = treeColumnWidthPx(300, 3, true, box);
    expect(width).toBeGreaterThanOrEqual(box.contentMargin.left + box.contentMargin.right);
  });
  it('stays at the bare minimum width when the content rect is too narrow to expand at all', () => {
    const box = THEME.widgets.button.pressed;
    const minWidth = box.contentMargin.left + box.contentMargin.right;
    expect(treeColumnWidthPx(minWidth * 3, 3, true, box)).toBe(minWidth);
  });
});
