/** The order children enter the tree: the unmoved ones first, then the ones an `index=` moved. */
import { describe, expect, it } from 'vitest';
import { childEnterOrders } from './treeOrder';

describe('childEnterOrders', () => {
  it('keeps the listed order when no child states an index', () => {
    expect(childEnterOrders([2], [{}, {}, {}])).toEqual([
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
  });

  it('puts a child that index= moved first after the children it was added after', () => {
    // As listed: VB (moved to 0), Cube (the sub-scene's own), VA (added after VB).
    expect(childEnterOrders([], [{ index: 0 }, {}, { index: 2 }])).toEqual([[1], [0], [2]]);
  });

  it('keeps the moved children in their listed order among themselves', () => {
    expect(childEnterOrders([], [{ index: 0 }, { index: 1 }, {}])).toEqual([[1], [2], [0]]);
  });
});
