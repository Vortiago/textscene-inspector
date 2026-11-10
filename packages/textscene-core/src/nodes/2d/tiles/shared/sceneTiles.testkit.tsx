/**
 * Test fixtures for the scene tiles of a tile layer: the five scenes the TileSet's scene tiles
 * instantiate, the resources that name them, and a render that reads back what is drawn. The
 * scenes and the 64 px grid are the ones the Godot 4.6.3 measurements in the tests were taken on.
 */
import { expect } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
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

/** The `[ext_resource]` and `[sub_resource]` headings of a TileSet with scene tiles 1 to 5 in source 0. */
export const SCENE_TILESET_RESOURCES = `[ext_resource type="PackedScene" path="res://polygon.tscn" id="1"]
[ext_resource type="PackedScene" path="res://offset.tscn" id="2"]
[ext_resource type="PackedScene" path="res://control.tscn" id="3"]
[ext_resource type="PackedScene" path="res://yellow.tscn" id="4"]
[ext_resource type="PackedScene" path="res://magenta.tscn" id="5"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("1")
scenes/2/scene = ExtResource("3")
scenes/3/scene = ExtResource("2")
scenes/4/scene = ExtResource("4")
scenes/5/scene = ExtResource("5")

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
  /** Changes the parsed scene before it renders, such as the cells of a layer. */
  prepare?: (scene: TscnScene) => void;
}

/**
 * Renders `tscn` in the 2D canvas with the five tile scenes loaded. The Controls of a scene tile
 * load lazily, so their module loads first and the first settle mounts them.
 */
export async function renderSceneTiles(tscn: string, options: RenderSceneTilesOptions = {}) {
  await import('../../../../r3f/controls/native/UnownedNodeControls');
  const fake = createFakeResourceLoader();
  for (const [path, text] of Object.entries(TILE_SCENES)) {
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

/** Every node of `nodes` and below, for a test that sets cells on a parsed node. */
export function nodesOfType(nodes: readonly TscnNode[], type: string, out: TscnNode[] = []): TscnNode[] {
  for (const node of nodes) {
    if (node.type === type) out.push(node);
    nodesOfType(node.children, type, out);
  }
  return out;
}
