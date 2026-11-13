/**
 * The live sort of a scene tile, whose placement node has no group because no mixer drives it: the
 * lifted-past groups carry the animation and the placement's fixed pose rides on top.
 */
import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { liveGroupChain, liveRootPose, sortYOfChain } from './ySortLiveItems';
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
const placement = {
  name: '@SceneTile@0_0',
  type: 'Node2D',
  parent: '.',
  children: [],
  properties: { position: { x: 0, y: 30 } },
  rawProperties: {},
  isUnowned: true,
  ySortRoot: { pose: { ...TRANSFORM2D_IDENTITY, ty: 80 } },
} as unknown as LiveNode;
const item = {
  sortY: 0,
  treeOrder: 0,
  kind: 'node',
  node: placement,
  liftedPast: [layer],
} as YSortItem;

describe('a scene tile in a lifted layer', () => {
  it('reads the groups of the lifted layer and none for its own placement', () => {
    const layerGroup = new Object3D();
    const paths: string[] = [];
    const chain = liveGroupChain(item, 'Root', (path) => (paths.push(path), layerGroup));
    expect(paths).toEqual(['Root/Layer']);
    expect(chain).toEqual([layerGroup]);
  });

  it('reads no group for a Control, which the Control walk places', () => {
    const control = { ...layer, type: 'ColorRect' } as unknown as TscnNode;
    const controlItem = { ...item, node: control, liftedPast: [] } as YSortItem;
    expect(liveGroupChain(controlItem, 'Root', () => new Object3D())).toBeNull();
  });

  it('sorts on the layer pose moved by the mixer plus the placement and root offsets', () => {
    const layerGroup = new Object3D();
    layerGroup.position.set(0, -100, 0);
    expect(sortYOfChain([layerGroup], liveRootPose(item))).toBe(100 + 30 + 80);
  });
});
