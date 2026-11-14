/** The RTL mirror of ItemList's icon rect and wrapped text box (`scene/gui/item_list.cpp:1582-1584,1639-1641`). */
import { describe, expect, it } from 'vitest';
import type {} from '../../../../r3f/controls/native/solveTree';
import type {} from '../../../../r3f/controls/native/solverRegistry';
import type {} from './types';
import { itemListMirrorX } from './mirrorX';
import type {} from '../../../../godot/math/vector';
import type {} from './nativeSolver';

describe('itemListMirrorX', () => {
  // item_list.cpp:1582-1584 (icon) and :1639-1641 (wrapped text box) both
  // mirror inside `size.width`, the control's own width.
  it('leaves the LTR x untouched', () => {
    expect(itemListMirrorX(6, 16, 200, false)).toBe(6);
  });
  it('mirrors a piece inside the control own width', () => {
    expect(itemListMirrorX(6, 16, 200, true)).toBe(178);
  });
  it('leaves a full-width piece in place', () => {
    expect(itemListMirrorX(0, 200, 200, true)).toBe(0);
  });
});
