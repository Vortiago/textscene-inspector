/**
 * The size and geometry of a PopupMenu, against values measured in Godot 4.6.3
 * (`testing/menuGeometry/`, a 1152x648 embedder at the default theme scale).
 */
import { describe, expect, it } from 'vitest';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { popupMenuGeometry } from './menuLayout';
import { many, menu, text } from './testing/menuNode';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

/** `get_contents_minimum_size()`, which wraps the window. A fresh context: it memoises by path. */
function contentsMinimum(window: SolveNode, embedderSize = EMBEDDER) {
  return createSolveContext(THEME, measureText, undefined, embedderSize).combinedMinimumSize(window);
}

function sizeOf(window: SolveNode) {
  return wrappedWindowSize(window, THEME, measureText, EMBEDDER);
}

function geometryOf(window: SolveNode) {
  return popupMenuGeometry(window, sizeOf(window), createSolveContext(THEME, measureText));
}

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('the contents minimum', () => {
  it('holds the panel, the scroll bar column, the text and the check column of plain items', () => {
    expect(contentsMinimum(menu(text('Open', 'Save as')))).toEqual({ x: 98, y: 62 });
  });

  it('is the panel margins and the check column alone for no items', () => {
    expect(contentsMinimum(menu([]))).toEqual({ x: 40, y: 8 });
  });

  it('gives an item with no text the font height', () => {
    expect(contentsMinimum(menu([{}]))).toEqual({ x: 40, y: 35 });
  });

  it('gives a separator no height of its own, only the gap under it', () => {
    expect(contentsMinimum(menu([{ separator: true }]))).toEqual({ x: 40, y: 12 });
  });

  it('shares one column between the icon and the check in a compact gutter', () => {
    expect(contentsMinimum(menu([{ text: 'Open', icon: { x: 20, y: 12 } }, ...text('Save')]))).toEqual({
      x: 86,
      y: 62,
    });
  });

  it('takes the icon height when it exceeds the font height', () => {
    const wide = menu([{ text: 'Open', icon: { x: 60, y: 30 } }, ...text('Save')]);
    expect(contentsMinimum(wide)).toEqual({ x: 126, y: 69 });
  });

  it('splits the gutter once a checkable item has an icon', () => {
    const split = menu([{ text: 'Open', icon: { x: 20, y: 12 }, checkable: 1 }, ...text('Save')]);
    expect(contentsMinimum(split)).toEqual({ x: 106, y: 62 });
  });

  it('measures a labelled separator by its text and its font height', () => {
    expect(
      contentsMinimum(menu([...text('Open'), { text: 'Section', separator: true }, ...text('Save')]))
    ).toEqual({
      x: 97,
      y: 89,
    });
  });

  it('adds a separator icon to the widest icon', () => {
    const labelled = menu([
      ...text('Open'),
      { text: 'Section', separator: true, icon: { x: 20, y: 12 } },
      ...text('Save'),
    ]);
    expect(contentsMinimum(labelled)).toEqual({ x: 101, y: 89 });
  });

  it('limits the height to the embedder', () => {
    expect(contentsMinimum(menu(many(30)))).toEqual({ x: 99, y: 648 });
    expect(contentsMinimum(menu(many(30)), { x: 1152, y: 300 }).y).toBe(300);
  });

  it('is unlimited without an embedder', () => {
    const ctx = createSolveContext(THEME, measureText);
    expect(ctx.combinedMinimumSize(menu(many(30))).y).toBe(818);
  });
});

describe('the window a menu wraps', () => {
  it('keeps the 100x100 default where the items fit', () => {
    expect(sizeOf(menu(text('Open', 'Save as')))).toEqual({ x: 100, y: 100 });
  });

  it('grows to the items', () => {
    const six = menu([
      ...text('Open'),
      { text: 'Autosave', checkable: 1, checked: true },
      { text: 'Fast mode', checkable: 2, checked: true },
      { separator: true },
      { text: 'Slow mode', checkable: 2 },
      { text: 'Quit', disabled: true },
    ]);
    expect(sizeOf(six)).toEqual({ x: 125, y: 147 });
  });

  it('never shrinks below the authored size', () => {
    expect(sizeOf(menu(text('Open', 'Save as'), { size: 'Vector2i(300, 200)' }))).toEqual({ x: 300, y: 200 });
  });

  it('grows past a smaller authored size to its minimum', () => {
    expect(sizeOf(menu(text('Open', 'Save as'), { size: 'Vector2i(10, 10)' }))).toEqual({ x: 98, y: 62 });
  });

  it('is cut to the embedder height', () => {
    expect(sizeOf(menu(many(30)))).toEqual({ x: 100, y: 648 });
  });
});

describe('the geometry', () => {
  it('fills the panel margins with the scroll container and the item control', () => {
    const six = menu([...text('Open', 'Autosave', 'Fast mode', 'Slow mode', 'Quit'), { separator: true }]);
    const geometry = geometryOf(six);
    expect(geometry.panel).toEqual(rect(0, 0, 125, 147));
    expect(geometry.scroll).toEqual(rect(4, 4, 117, 139));
    expect(geometry.control).toEqual(rect(4, 4, 117, 139));
    expect(geometry.verticalBar.visible).toBe(false);
  });

  it('places each row from half a gap, then a gap after every row', () => {
    const geometry = geometryOf(menu(text('Open', 'Save as', 'Quit')));
    expect(geometry.rows.map(({ y }) => y)).toEqual([2, 29, 56]);
  });

  it('shows the scroll bar for items taller than the menu and makes room for it', () => {
    const geometry = geometryOf(menu(many(30)));
    expect(geometry.scroll).toEqual(rect(4, 4, 92, 640));
    expect(geometry.control).toEqual(rect(4, 4, 84, 810));
    expect(geometry.verticalBar.visible).toBe(true);
    expect(geometry.verticalBar.rect).toEqual(rect(84, 0, 8, 640));
  });

  it('keeps the bar hidden where the items fill the container exactly', () => {
    const six = menu(text('Open', 'Save as'), { size: 'Vector2i(98, 62)' });
    expect(geometryOf(six).verticalBar.visible).toBe(false);
  });

  it('puts the bar on the left under right-to-left layout and moves the control past it', () => {
    const geometry = geometryOf(menu(many(30), {}, true));
    expect(geometry.verticalBar.rect.x).toBe(0);
    expect(geometry.control).toEqual(rect(12, 4, 84, 810));
  });
});
