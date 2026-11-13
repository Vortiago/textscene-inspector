/** Tree's draw-time geometry against `scene/gui/tree.cpp` (Godot 4.6.3), for the always-empty case (`nativeSolver.ts`). */
import { describe, expect, it } from 'vitest';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import {
  treeTitleButtonHeightPx,
  treeContentRect,
  treeColumnWidthPx,
  treeTitleButtonX,
} from './nativeSolver';

const TREE_BOXES = defaultStyleBoxesOf(defaultThemeAt(1)).Tree!;
const DEFAULT_PANEL = TREE_BOXES.panel!;
const TITLE_BUTTON = TREE_BOXES.title_button_normal!;

describe('treeTitleButtonHeightPx', () => {
  it('is zero when column_titles_visible is unset', () => {
    expect(treeTitleButtonHeightPx(undefined, TITLE_BUTTON)).toBe(0);
  });
  it("is the title button's own content-margin height when visible, even with a blank title", () => {
    const box = TITLE_BUTTON;
    expect(treeTitleButtonHeightPx(true, box)).toBe(box.contentMargin.top + box.contentMargin.bottom);
  });
});

describe('treeContentRect', () => {
  it("insets the rect by the panel stylebox's own margins", () => {
    const box = DEFAULT_PANEL;
    const rect = treeContentRect({ x: 200, y: 100 }, box);
    expect(rect).toEqual({
      x: box.contentMargin.left,
      y: box.contentMargin.top,
      w: 200 - box.contentMargin.left - box.contentMargin.right,
      h: 100 - box.contentMargin.top - box.contentMargin.bottom,
    });
  });
  it('floors at zero extent rather than going negative for a rect smaller than the margins', () => {
    const box = DEFAULT_PANEL;
    const rect = treeContentRect({ x: 1, y: 1 }, box);
    expect(rect.w).toBe(0);
    expect(rect.h).toBe(0);
  });
});

describe('treeColumnWidthPx', () => {
  it('splits the content width evenly across columns when titles are hidden (zero minimum each)', () => {
    const box = TITLE_BUTTON;
    expect(treeColumnWidthPx(300, 3, false, box)).toBe(100);
  });
  it("floors each column at the title button's own L+R margin once titles are visible", () => {
    const box = TITLE_BUTTON;
    const width = treeColumnWidthPx(300, 3, true, box);
    expect(width).toBeGreaterThanOrEqual(box.contentMargin.left + box.contentMargin.right);
  });
  it('stays at the bare minimum width when the content rect is too narrow to expand at all', () => {
    const box = TITLE_BUTTON;
    const minWidth = box.contentMargin.left + box.contentMargin.right;
    expect(treeColumnWidthPx(minWidth * 3, 3, true, box)).toBe(minWidth);
  });
});

describe('treeTitleButtonX', () => {
  // tree.cpp:5154-5160: `ofs2` starts at the panel's SIDE_LEFT margin and
  // advances one column width per header cell.
  it('walks the header cells left to right from the panel margin', () => {
    expect(treeTitleButtonX(0, 4, 30, 100, false)).toBe(4);
    expect(treeTitleButtonX(1, 4, 30, 100, false)).toBe(34);
    expect(treeTitleButtonX(2, 4, 30, 100, false)).toBe(64);
  });
  // tree.cpp:5158-5160: `tbrect.position.x = get_size().width - tbrect.size.x
  // - tbrect.position.x`, mirrored inside the Tree's own width.
  it('mirrors each cell inside the Tree own width under RTL', () => {
    expect(treeTitleButtonX(0, 4, 30, 100, true)).toBe(66);
    expect(treeTitleButtonX(1, 4, 30, 100, true)).toBe(36);
    expect(treeTitleButtonX(2, 4, 30, 100, true)).toBe(6);
  });
  it('leaves a single full-width column in place under RTL', () => {
    expect(treeTitleButtonX(0, 0, 100, 100, true)).toBe(0);
  });
});
