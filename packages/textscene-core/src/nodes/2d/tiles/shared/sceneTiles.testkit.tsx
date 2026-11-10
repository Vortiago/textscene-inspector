/**
 * Test fixtures for the scene tiles of a tile layer: the scenes the TileSet's scene tiles
 * instantiate, the resources that name them, and a render that reads back what is drawn. The
 * scenes and the 64 px grid are the ones the Godot 4.6.3 measurements in the tests were taken on.
 */
import { expect } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { flatten } from '../../../../parser/testing/parserKit';
import { createSceneGraphFromTscnScene } from '../../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../../parser/TscnParser';
import type { TscnNode, TscnScene } from '../../../../parser/types';
import { useSelection, type SelectionContextValue } from '../../../../r3f/contexts/SelectionContext';
import { useLiveSceneNodes } from '../../../../r3f/useLiveSceneTree';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import { computeWorldBoundingBox } from '../../../../r3f/bounds';
import { compareKeys, paintKey } from '../../../../r3f/testing/paintOrder';
import '../../../../r3f/nodes/index';
import type { PlacedCell } from './tileData';
import type { TileMapProperties } from '../tilemap/types';

/** Scene tile 1: a Node2D root holding a 20x10 red polygon. */
const POLYGON_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Shape" type="Polygon2D" parent="."]
color = Color(1, 0, 0, 1)
polygon = PackedVector2Array(0, 0, 20, 0, 20, 10, 0, 10)
`;

/** Scene tile 3: a Node2D root at (5, 3) holding a 10x10 blue polygon. */
const OFFSET_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(5, 3)

[node name="Shape" type="Polygon2D" parent="."]
color = Color(0, 0, 1, 1)
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;

/** Scene tile 2: a ColorRect root from (-5, -5) to (5, 5). */
const CONTROL_SCENE = `[gd_scene format=3]

[node name="Root" type="ColorRect"]
offset_left = -5.0
offset_top = -5.0
offset_right = 5.0
offset_bottom = 5.0
color = Color(0, 1, 0, 1)
`;

/** Scene tile 4: a 20x100 yellow polygon root that ends at its cell's centre. */
const YELLOW_SCENE = `[gd_scene format=3]

[node name="Root" type="Polygon2D"]
color = Color(1, 1, 0, 1)
polygon = PackedVector2Array(-10, -100, 10, -100, 10, 0, -10, 0)
`;

/** Scene tile 5: a 30x100 magenta polygon root that ends at its cell's centre. */
const MAGENTA_SCENE = `[gd_scene format=3]

[node name="Root" type="Polygon2D"]
color = Color(1, 0, 1, 1)
polygon = PackedVector2Array(-15, -100, 15, -100, 15, 0, -15, 0)
`;

/** Scene tile 7: a plain Node root, which Godot refuses (`tile_set.cpp:5814-5836`). Its polygon never draws. */
const PLAIN_NODE_SCENE = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Shape" type="Polygon2D" parent="."]
color = Color(1, 0, 0, 1)
polygon = PackedVector2Array(0, 0, 20, 0, 20, 10, 0, 10)
`;

/** Scene tile 8: a Node2D root at (0, 80) that holds a 30x30 red polygon, which ends 10 px above the cell's centre. */
const LOW_ROOT_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(0, 80)

[node name="Shape" type="Polygon2D" parent="."]
color = Color(1, 0, 0, 1)
polygon = PackedVector2Array(0, -90, 30, -90, 30, -60, 0, -60)
`;

/** Scene tile 9: a Node2D root without an offset that holds a 30x30 blue polygon above the cell's centre. */
const PLAIN_ROOT_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Shape" type="Polygon2D" parent="."]
color = Color(0, 0, 1, 1)
polygon = PackedVector2Array(0, -60, 30, -60, 30, -30, 0, -30)
`;

/** Scene tile 10: a Node2D root with three polygons of widths 30, 20 and 10 that draw in that order. */
const STACK_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Wide" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 30, 0, 30, 10, 0, 10)

[node name="Middle" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 20, 0, 20, 10, 0, 10)

[node name="Narrow" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)
`;

/** Scene tile 11: a Node2D root with a z_index of 1 that holds a 10x10 green polygon. */
const RAISED_ROOT_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]
z_index = 1

[node name="Shape" type="Polygon2D" parent="."]
color = Color(0, 1, 0, 1)
polygon = PackedVector2Array(-5, -5, 5, -5, 5, 5, -5, 5)
`;

/** The `[ext_resource]` and `[sub_resource]` headings of a TileSet with the scene tiles 1 to 5 and 7 to 11 in source 0. */
export const SCENE_TILESET_RESOURCES = `[ext_resource type="PackedScene" path="res://polygon.tscn" id="1"]
[ext_resource type="PackedScene" path="res://offset.tscn" id="2"]
[ext_resource type="PackedScene" path="res://control.tscn" id="3"]
[ext_resource type="PackedScene" path="res://yellow.tscn" id="4"]
[ext_resource type="PackedScene" path="res://magenta.tscn" id="5"]
[ext_resource type="PackedScene" path="res://plain.tscn" id="6"]
[ext_resource type="PackedScene" path="res://low-root.tscn" id="7"]
[ext_resource type="PackedScene" path="res://plain-root.tscn" id="8"]
[ext_resource type="PackedScene" path="res://stack.tscn" id="9"]
[ext_resource type="PackedScene" path="res://raised-root.tscn" id="10"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("1")
scenes/2/scene = ExtResource("3")
scenes/3/scene = ExtResource("2")
scenes/4/scene = ExtResource("4")
scenes/5/scene = ExtResource("5")
scenes/7/scene = ExtResource("6")
scenes/8/scene = ExtResource("7")
scenes/9/scene = ExtResource("8")
scenes/10/scene = ExtResource("9")
scenes/11/scene = ExtResource("10")

[sub_resource type="TileSet" id="tileset"]
tile_size = Vector2i(64, 64)
sources/0 = SubResource("scenes")
`;

const TILE_SCENES: Record<string, string> = {
  'res://polygon.tscn': POLYGON_SCENE,
  'res://offset.tscn': OFFSET_SCENE,
  'res://control.tscn': CONTROL_SCENE,
  'res://yellow.tscn': YELLOW_SCENE,
  'res://magenta.tscn': MAGENTA_SCENE,
  'res://plain.tscn': PLAIN_NODE_SCENE,
  'res://low-root.tscn': LOW_ROOT_SCENE,
  'res://plain-root.tscn': PLAIN_ROOT_SCENE,
  'res://stack.tscn': STACK_SCENE,
  'res://raised-root.tscn': RAISED_ROOT_SCENE,
};

/** What the viewport and the Scene dock see of the rendered scene. */
export interface SceneTileProbe {
  selection: SelectionContextValue | null;
  /** The path of every node of the live tree, which is what the Scene dock lists. */
  livePaths: string[];
}

const everyNode = () => true;

function Probe({ probe, children }: { probe: SceneTileProbe; children: ReactNode }) {
  probe.selection = useSelection();
  probe.livePaths = useLiveSceneNodes(everyNode).map((entry) => entry.path);
  return children;
}

export interface RenderSceneTilesOptions {
  showGizmos?: boolean;
  selectedPath?: string | null;
  /** The `res://` paths of tile scenes that never finish loading. */
  withheldScenes?: string[];
  /** Changes the parsed scene before it renders, such as the cells of a layer. */
  prepare?: (scene: TscnScene) => void;
}

/**
 * Renders `tscn` in the 2D canvas with the tile scenes loaded. The Controls of a scene tile
 * load lazily, so their module loads first and the first settle mounts them.
 */
export async function renderSceneTiles(tscn: string, options: RenderSceneTilesOptions = {}) {
  await import('../../../../r3f/controls/native/UnownedNodeControls');
  const fake = createFakeResourceLoader();
  for (const [path, text] of Object.entries(TILE_SCENES)) {
    if (options.withheldScenes?.includes(path)) continue;
    fake.scenes._resolve(path, new TscnParser().parse(text));
  }
  const probe: SceneTileProbe = { selection: null, livePaths: [] };
  const treeOf = (text: string, prepare?: (scene: TscnScene) => void) => {
    const scene = new TscnParser().parse(text);
    prepare?.(scene);
    return (
      <DispatchedScene
        sceneGraph={createSceneGraphFromTscnScene(scene)}
        loader={fake.loader}
        workspace="2d"
        showGizmos={options.showGizmos}
        selectedPath={options.selectedPath}
        around={(nodes) => <Probe probe={probe}>{nodes}</Probe>}
      />
    );
  };
  const renderer = await ReactThreeTestRenderer.create(treeOf(tscn, options.prepare), {
    orthographic: true,
    camera: { position: [0, 0, 10] },
  });
  await settleLoads();
  return {
    renderer,
    probe,
    /** The scene after an edit of its file: a new parse, as the previewer reads one. */
    async edit(edited: string, prepare?: (scene: TscnScene) => void) {
      await renderer.update(treeOf(edited, prepare));
      await settleLoads();
    },
  };
}

type Renderer = Awaited<ReturnType<typeof renderSceneTiles>>['renderer'];

/** A Godot-pixel box: x, y, width, height. */
export type Box = [number, number, number, number];

/** Every mesh the scene draws, with its Godot-pixel box. */
export function drawnMeshes(renderer: Renderer): { box: Box; mesh: THREE.Object3D }[] {
  const root = renderer.scene.instance as THREE.Object3D;
  root.updateMatrixWorld(true);
  const meshes: { box: Box; mesh: THREE.Object3D }[] = [];
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const box = computeWorldBoundingBox(object);
    // The canvas flips y: three's y is Godot's negated.
    const godotBox = [box.min.x, -box.max.y, box.max.x - box.min.x, box.max.y - box.min.y].map(Math.round);
    meshes.push({ box: godotBox as Box, mesh: object });
  });
  return meshes;
}

/** The one mesh the scene draws. */
export function onlyMesh(renderer: Renderer): THREE.Mesh {
  const meshes = drawnMeshes(renderer);
  expect(meshes).toHaveLength(1);
  return meshes[0]!.mesh as THREE.Mesh;
}

/** The Godot-pixel box of every mesh the scene draws, left to right. */
export function drawnBoxes(renderer: Renderer): Box[] {
  return drawnMeshes(renderer)
    .map(({ box }) => box)
    .sort((a, b) => a[0] - b[0]);
}

/** The boxes in the order three paints them: the last is on top. */
export function boxesInPaintOrder(renderer: Renderer): Box[] {
  return drawnMeshes(renderer)
    .sort((a, b) => compareKeys(paintKey(a.mesh), paintKey(b.mesh)))
    .map(({ box }) => box);
}

/** Sets the cells of each layer of a TileMap, which the parse would read from `layer_N/tile_data`. */
export const withLayerCells =
  (...layerCells: PlacedCell[][]) =>
  (scene: TscnScene) => {
    const { layers } = nodesOfType(scene, 'TileMap')[0]!.properties as TileMapProperties;
    layerCells.forEach((cells, index) => {
      layers[index]!.cells = cells;
    });
  };

/** The nodes of a parsed scene of one type, for a test that sets cells on a parsed node. */
export const nodesOfType = (scene: TscnScene, type: string): TscnNode[] =>
  flatten(scene).filter((node) => node.type === type);
