/**
 * The collection half of the y-sort pass: which items one flat sort holds, and the sort y of each.
 */
import { describe, expect, it } from 'vitest';
import { collectSortRootRows, collectYSortedItems, Y_SORT_ROOT } from './ySortItems';
import type { TscnNode } from '../parser/types';

import './nodes/index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, properties, rawProperties: {}, children } as unknown as TscnNode;
}

const root = (children: TscnNode[]) => node('Root', 'Node2D', { y_sort_enabled: true }, children);

describe('collectYSortedItems', () => {
  it("merges a y-sorted TileMapLayer's children into the sort, lifted past the layer", () => {
    const prop = node('Prop', 'Node2D', { position: { x: 0, y: 5 } });
    const layer = node('Ground', 'TileMapLayer', { y_sort_enabled: true, position: { x: 0, y: 40 } }, [prop]);
    const items = collectYSortedItems(root([layer]), Y_SORT_ROOT, 0);
    expect(items.map((item) => [item.kind, item.node?.name, item.sortY])).toEqual([
      ['tileGroup', 'Ground', 40],
      ['node', 'Prop', 45],
    ]);
    expect(items[1]!.liftedPast).toEqual([layer]);
  });

  it('gives a Node3D child the sort y of its parent, not the NaN of its Vector3 rotation', () => {
    const marker = node('Marker', 'Node3D', {
      position: { x: 0, y: 7, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    const [item] = collectYSortedItems(root([marker]), Y_SORT_ROOT, 0);
    expect(item!.sortY).toBe(0);
  });

  it('sorts a TileMapLayer at its own origin, since its `y_sort_origin` moves only its rows', () => {
    const layer = node('Ground', 'TileMapLayer', {
      y_sort_enabled: true,
      y_sort_origin: 16,
      position: { x: 0, y: 40 },
    });
    const [item] = collectYSortedItems(root([layer]), Y_SORT_ROOT, 0);
    expect(item!.sortY).toBe(40);
  });

  it('sorts on the live pose a pass pushes, and keeps the authored node for the renderer', () => {
    const pushed = node('Pushed', 'Node2D', { position: { x: 0, y: 5 } });
    const patches = new Map([['Root/Pushed', { position: { x: 0, y: 90 } }]]);
    const [item] = collectYSortedItems(root([pushed]), Y_SORT_ROOT, 0, [], { path: 'Root', patches });
    expect(item!.sortY).toBe(90);
    expect(item!.node).toBe(pushed);
  });
});

describe('collectSortRootRows', () => {
  it('lists the rows of a y-sorted TileMapLayer as one tileGroup item at the sort origin, without its children', () => {
    const prop = node('Prop', 'Node2D', {});
    const layer = node('Ground', 'TileMapLayer', { y_sort_enabled: true, tile_set: 'ExtResource("1")' }, [
      prop,
    ]);
    const item = collectSortRootRows(layer);
    expect([item?.kind, item?.tileData?.tileSetRef, item?.sortY, item?.isSortRootRows]).toEqual([
      'tileGroup',
      'ExtResource("1")',
      0,
      true,
    ]);
    expect(item?.node?.children).toEqual([]);
  });

  it.each([
    ['a TileMapLayer that is not y-sorted', node('Ground', 'TileMapLayer', {})],
    ['a y-sorted Node2D', node('World', 'Node2D', { y_sort_enabled: true })],
  ])('lists no rows for %s', (_, sortRoot) => {
    expect(collectSortRootRows(sortRoot)).toBeNull();
  });
});
