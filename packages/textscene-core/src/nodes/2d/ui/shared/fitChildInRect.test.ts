/**
 * `Container::as_sortable_control` (`scene/gui/container.cpp:143-155`): which children a container
 * arranges, and the four ways a child falls out of that list.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  fitChildInRect,
  isSortableControl,
  SIZE_FILL,
  SIZE_SHRINK_CENTER,
  SIZE_SHRINK_END,
} from './fitChildInRect';

function child(properties: Record<string, unknown>, extra: Partial<SolveNode> = {}): SolveNode {
  return {
    path: 'Root/Child',
    node: { name: 'Child', type: 'Label', children: [], properties },
    children: [],
    skippedAncestors: null,
    hidden: false,
    ...extra,
  } as unknown as SolveNode;
}

describe('isSortableControl', () => {
  it('arranges an ordinary visible child', () => {
    expect(isSortableControl(child({}))).toBe(true);
  });

  it('skips an invisible child rather than laying out an empty slot', () => {
    expect(isSortableControl(child({ visible: false }))).toBe(false);
  });

  it('skips a child the eye toggle hid', () => {
    expect(isSortableControl(child({}, { hidden: true }))).toBe(false);
  });

  it('skips a promoted child, which the container’s own cast never reaches', () => {
    const promoted = child({}, {
      skippedAncestors: { transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } },
    } as Partial<SolveNode>);
    expect(isSortableControl(promoted)).toBe(false);
  });

  it('skips a top_level child, whose flag the cast rejects before visibility', () => {
    // `if (!c || c->is_set_as_top_level()) return nullptr;` (container.cpp:144-146) runs ahead of
    // every visibility mode, so even `SortableVisibilityMode::IGNORE` drops it.
    expect(isSortableControl(child({ topLevel: true }))).toBe(false);
  });
});

/**
 * `Container::fit_child_in_rect`'s horizontal shrink arms (`scene/gui/container.cpp:103-112`), where
 * `rtl` is the container's `is_layout_rtl()` and swaps which edge "begin" and "end" name.
 */
describe('fitChildInRect — the horizontal shrink arms under RTL', () => {
  const NO_FLAGS = 0;
  const CELL = { x: 10, y: 0, w: 100, h: 40 };
  const MIN = { x: 30, y: 40 };

  it('SHRINK_END takes the LEFT edge under RTL and the right edge under LTR', () => {
    //   r.position.x += rtl ? 0 : (p_rect.size.width - minsize.width);
    expect(fitChildInRect(CELL, MIN, SIZE_SHRINK_END, SIZE_FILL, true)).toEqual({
      x: 10,
      y: 0,
      w: 30,
      h: 40,
    });
    expect(fitChildInRect(CELL, MIN, SIZE_SHRINK_END, SIZE_FILL, false)).toEqual({
      x: 80,
      y: 0,
      w: 30,
      h: 40,
    });
  });

  it('no shrink bit takes the RIGHT edge under RTL and the left edge under LTR', () => {
    //   r.position.x += rtl ? (p_rect.size.width - minsize.width) : 0;
    expect(fitChildInRect(CELL, MIN, NO_FLAGS, SIZE_FILL, true)).toEqual({
      x: 80,
      y: 0,
      w: 30,
      h: 40,
    });
    expect(fitChildInRect(CELL, MIN, NO_FLAGS, SIZE_FILL, false)).toEqual({
      x: 10,
      y: 0,
      w: 30,
      h: 40,
    });
  });

  it('SHRINK_CENTER and the vertical axis ignore the direction entirely', () => {
    // `container.cpp:107` has no `rtl` ternary, and `:114-122` names no `rtl`: only the horizontal
    // begin/end pair mirrors.
    expect(fitChildInRect(CELL, MIN, SIZE_SHRINK_CENTER, SIZE_SHRINK_END, true)).toEqual(
      fitChildInRect(CELL, MIN, SIZE_SHRINK_CENTER, SIZE_SHRINK_END, false)
    );
    expect(fitChildInRect(CELL, { x: 30, y: 10 }, SIZE_FILL, SIZE_SHRINK_END, true)).toEqual({
      x: 10,
      y: 30,
      w: 100,
      h: 10,
    });
  });

  it('SIZE_FILL short-circuits the whole horizontal arm, so RTL cannot move it', () => {
    expect(fitChildInRect(CELL, MIN, SIZE_FILL | SIZE_SHRINK_END, SIZE_FILL, true)).toEqual(CELL);
  });
});
