/**
 * The live sort of an item reads the poses on the groups between the sort root and it. A scene
 * tile's instance and a Control read none: the canvas item pass sorts them where they are placed.
 */
import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { liveGroupChain, sortYOfChain } from './ySortLiveItems';
import { TRANSFORM2D_IDENTITY } from '../godot/math/transform2d';
import type { LiveNode } from '../resources/liveNode';
import type { YSortItem } from './ySortItems';
import type { TscnNode } from '../parser/types';

const layer = {
  name: 'Layer',
  type: 'Node2D',
  parent: '.',
  children: [],
  properties: {},
} as unknown as TscnNode;

function itemOf(node: TscnNode, liftedPast: TscnNode[] = []): YSortItem {
  return { sortY: 0, treeOrder: 0, kind: 'node', node, liftedPast } as YSortItem;
}

describe('the live group chain', () => {
  it('reads the groups of the lifted layer and of the node itself', () => {
    const paths: string[] = [];
    const sprite = { ...layer, name: 'Sprite' } as TscnNode;
    liveGroupChain(itemOf(sprite, [layer]), 'Root', (path) => (paths.push(path), new Object3D()));
    expect(paths).toEqual(['Root/Layer', 'Root/Layer/Sprite']);
  });

  it("reads no group for a scene tile's instance, which registers none", () => {
    const tile = { ...layer, name: '@SceneTile@0_0', isUnowned: true } as LiveNode;
    expect(liveGroupChain(itemOf(tile, [layer]), 'Root', () => new Object3D())).toBeNull();
  });

  it('reads no group for a Control, which the Control walk places', () => {
    const control = { ...layer, type: 'ColorRect' } as TscnNode;
    expect(liveGroupChain(itemOf(control), 'Root', () => new Object3D())).toBeNull();
  });
});

describe('the root pose of a tile row', () => {
  it("sorts on the layer pose moved by the mixer plus the row's origin", () => {
    const row = {
      ...itemOf(layer),
      tileData: { rowOrigin: { ...TRANSFORM2D_IDENTITY, ty: 80 } },
    } as YSortItem;
    const layerGroup = new Object3D();
    layerGroup.position.set(0, -100, 0);
    expect(sortYOfChain([layerGroup], row.tileData?.rowOrigin)).toBe(100 + 80);
  });
});
