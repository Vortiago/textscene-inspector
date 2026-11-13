/**
 * A tile layer's scene tiles are live children of the layer: `_scenes_update_cell` instantiates the
 * scene of each cell and adds it after the authored children (`tile_map_layer.cpp:1626-1651`), at
 * `map_to_local` of the cell. With TileMap, the instances are children of the TileMap (`:1646`).
 */
import { describe, expect, it } from 'vitest';
import { contextOver, liveTreeOfText, livePathsOf } from './liveSceneTree.testkit';
import { liveTreeOf, type LiveTree } from './liveSceneTree';
import { TscnParser } from '../parser/TscnParser';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import type { ControlProperties } from '../nodes/2d/ui/control/types';
import './nodes/index';

const HEADER = '[gd_scene format=3]\n\n';

const NODE2D_SCENE = `${HEADER}[node name="Crate" type="Node2D"]
position = Vector2(5, 3)

[node name="Body" type="Polygon2D" parent="."]
`;

const CONTROL_SCENE = `${HEADER}[node name="Panel" type="Control"]
offset_left = 2.0
offset_top = 4.0
offset_right = 12.0
offset_bottom = 14.0
`;

const NODE3D_SCENE = `${HEADER}[node name="Prop" type="Node3D"]\n`;

const SCENES = {
  'res://crate.tscn': NODE2D_SCENE,
  'res://panel.tscn': CONTROL_SCENE,
  'res://prop.tscn': NODE3D_SCENE,
};

/** One cell: its coords, and the scene tile it names in source 0 with its alternative bits. */
interface Cell {
  x: number;
  y: number;
  tile: number;
}

/** `tile_map_data` for `cells` of source 0, each 12 bytes after the format header (`tile_map_layer.cpp:2393-2416`). */
function tileMapData(cells: readonly Cell[]): string {
  const bytes = [0, 0];
  const u16 = (value: number) => bytes.push(value & 0xff, (value >> 8) & 0xff);
  for (const { x, y, tile } of cells) {
    [x, y, 0, 0, 0, tile].forEach(u16);
  }
  return `PackedByteArray(${bytes.join(', ')})`;
}

const TILE_SET = `[ext_resource type="PackedScene" path="res://crate.tscn" id="crate"]
[ext_resource type="PackedScene" path="res://panel.tscn" id="panel"]
[ext_resource type="PackedScene" path="res://prop.tscn" id="prop"]
[ext_resource type="PackedScene" path="res://gone.tscn" id="gone"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("crate")
scenes/2/scene = ExtResource("panel")
scenes/3/scene = ExtResource("prop")
scenes/4/scene = ExtResource("gone")
scenes/5/display_placeholder = true

[sub_resource type="TileSet" id="ts"]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("scenes")
`;

function layerScene(cells: readonly Cell[], layerLines = ''): string {
  return `${HEADER}${TILE_SET}
[node name="World" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_map_data = ${tileMapData(cells)}
tile_set = SubResource("ts")
${layerLines}
[node name="Authored" type="Node2D" parent="Layer"]
`;
}

function treeOf(cells: readonly Cell[], layerLines = ''): LiveTree {
  return liveTreeOfText(layerScene(cells, layerLines), SCENES);
}

/** The tree of `cells` with `res://gone.tscn` failed, as the loader answers a missing file. */
function treeWithFailedScene(cells: readonly Cell[]): LiveTree {
  const parse = (text: string) => new TscnParser().parse(text);
  const main = parse(layerScene(cells));
  const loaded = Object.fromEntries(Object.entries(SCENES).map(([path, text]) => [path, parse(text)]));
  const ctx = contextOver(main, loaded);
  const sceneCache = { getCached: (path: string) => (path === 'res://gone.tscn' ? null : loaded[path]) };
  return liveTreeOf(main.nodes, { ...ctx, sceneCache });
}

const childPaths = (tree: LiveTree, parent: string) =>
  livePathsOf(tree).filter(
    (path) => path.startsWith(`${parent}/`) && !path.slice(parent.length + 1).includes('/')
  );

describe('the scene tiles of a TileMapLayer', () => {
  it('follow the authored children, in the order of the cells', () => {
    const tree = treeOf([
      { x: 2, y: 1, tile: 1 },
      { x: 0, y: 0, tile: 2 },
    ]);
    expect(childPaths(tree, 'World/Layer')).toEqual([
      'World/Layer/Authored',
      'World/Layer/@SceneTile@2_1',
      'World/Layer/@SceneTile@0_0',
    ]);
  });

  it('merge into the root of the scene they instance', () => {
    const step = treeOf([{ x: 2, y: 1, tile: 1 }]).at('World/Layer/@SceneTile@2_1')!.step;
    expect([step.isMerged, step.node.type]).toEqual([true, 'Node2D']);
    expect(childPaths(treeOf([{ x: 2, y: 1, tile: 1 }]), 'World/Layer/@SceneTile@2_1')).toEqual([
      'World/Layer/@SceneTile@2_1/Body',
    ]);
  });

  it('move a Node2D root to map_to_local of the cell, after its own transform (:1706-1723)', () => {
    const root = treeOf([{ x: 2, y: 1, tile: 1 }]).at('World/Layer/@SceneTile@2_1')!.step.node;
    expect((root.properties as Node2DProperties).position).toEqual({ x: 80 + 5, y: 48 + 3 });
  });

  it('carry the pose of a Node2D root in the layer, which a y-sort sorts the tile on', () => {
    const tile = treeOf([{ x: 2, y: 1, tile: 1 }]).at('World/Layer/@SceneTile@2_1')!.raw;
    expect([tile.placedPose?.tx, tile.placedPose?.ty]).toEqual([80 + 5, 48 + 3]);
  });

  it('carry no pose for a Control root, which the Control walk places', () => {
    expect(
      treeOf([{ x: 1, y: 0, tile: 2 }]).at('World/Layer/@SceneTile@1_0')!.raw.placedPose
    ).toBeUndefined();
  });

  it('flip a Node2D root by the transform bits of the alternative', () => {
    // TRANSFORM_FLIP_H is 1 << 12 (`tile_set.h:291`), and the scene id is the alternative without it.
    const root = treeOf([{ x: 0, y: 0, tile: 1 | (1 << 12) }]).at('World/Layer/@SceneTile@0_0')!.step.node;
    const { position, scale } = root.properties as Node2DProperties;
    expect(position).toEqual({ x: 16 - 5, y: 16 + 3 });
    expect([Math.abs(scale.x), Math.abs(scale.y)]).toEqual([1, 1]);
  });

  it('move a Control root by map_to_local, which its layout adds after the file (:1635-1636)', () => {
    const root = treeOf([{ x: 1, y: 0, tile: 2 }]).at('World/Layer/@SceneTile@1_0')!.step.node;
    expect(root.controlPositionShift).toEqual({ x: 48, y: 16 });
    expect((root.properties as ControlProperties).offsetLeft).toBe(2);
  });

  it('add no child for a root that is no CanvasItem, which the TileSet refuses (tile_set.cpp:5828-5829)', () => {
    const tree = treeOf([{ x: 0, y: 0, tile: 3 }]);
    expect(childPaths(tree, 'World/Layer')).toEqual(['World/Layer/Authored']);
    expect(tree.at('World/Layer')!.step.placeholderTiles?.map(({ cell }) => cell.coords)).toEqual([
      { x: 0, y: 0 },
    ]);
  });

  it('add no child for a scene that failed to load, and mark its cell with a disc', () => {
    const tree = treeWithFailedScene([{ x: 3, y: 0, tile: 4 }]);
    expect(childPaths(tree, 'World/Layer')).toEqual(['World/Layer/Authored']);
    expect(tree.at('World/Layer')!.step.placeholderTiles?.length).toBe(1);
  });

  it('keep the child of a scene still loading, with no disc', () => {
    const tree = treeOf([{ x: 3, y: 0, tile: 4 }]);
    expect(childPaths(tree, 'World/Layer')).toEqual(['World/Layer/Authored', 'World/Layer/@SceneTile@3_0']);
    expect(tree.at('World/Layer')!.step.placeholderTiles).toEqual([]);
  });

  it('mark a tile with no scene with a disc, and add no child for it', () => {
    const tree = treeOf([{ x: 0, y: 2, tile: 5 }]);
    expect(childPaths(tree, 'World/Layer')).toEqual(['World/Layer/Authored']);
    expect(tree.at('World/Layer')!.step.placeholderTiles?.length).toBe(1);
  });

  it('add no child in a layer that is not enabled (tile_map_layer.cpp:1574-1580)', () => {
    const tree = treeOf([{ x: 0, y: 0, tile: 1 }], 'enabled = false\n');
    expect(childPaths(tree, 'World/Layer')).toEqual(['World/Layer/Authored']);
  });

  it('keep their node when the layer is built again, so a mounted tile stays mounted', () => {
    const parse = (text: string) => new TscnParser().parse(text);
    const main = parse(layerScene([{ x: 0, y: 0, tile: 1 }]));
    const loaded = Object.fromEntries(Object.entries(SCENES).map(([path, text]) => [path, parse(text)]));
    const ctx = contextOver(main, loaded);
    // An edit of the layer gives it a new node, as the parser does for a changed section.
    const edited = () => {
      const [world] = main.nodes;
      return [{ ...world!, children: world!.children.map((child) => ({ ...child })) }];
    };
    const tileOf = () => liveTreeOf(edited(), ctx).at('World/Layer/@SceneTile@0_0')!.raw;
    expect(tileOf()).toBe(tileOf());
  });

  it('are unowned, so a click on one selects no node of its own', () => {
    const tile = treeOf([{ x: 0, y: 0, tile: 1 }]).at('World/Layer/@SceneTile@0_0')!;
    expect(tile.raw.isUnowned).toBe(true);
  });
});

describe('the scene tiles of a TileMap', () => {
  const tree = liveTreeOfText(
    `${HEADER}${TILE_SET}
[node name="Map" type="TileMap"]
tile_set = SubResource("ts")
format = 2
layer_0/tile_data = PackedInt32Array(65538, 0, 65536)

[node name="Authored" type="Node2D" parent="."]
`,
    SCENES
  );

  it('are children of the TileMap, after its authored children', () => {
    expect(childPaths(tree, 'Map')).toEqual(['Map/Authored', 'Map/@SceneTile@2_1']);
  });
});
