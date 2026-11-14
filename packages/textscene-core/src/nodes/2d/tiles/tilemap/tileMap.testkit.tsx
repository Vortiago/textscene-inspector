/**
 * Test fixtures for a TileMap mounted through the dispatcher, as the preview mounts it: a root
 * Node2D holds the TileMap, whose atlas draws a 32 px texture, then a sibling polygon after it. The
 * TileMap holds one authored polygon child.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createSceneGraphFromTscnScene } from '../../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../../../../r3f/lighting2d/lightPassContext';
import '../../../../r3f/nodes/index';

const TEXTURE = 'res://tiles.png';

/** A 4 px polygon on light mask 2, so a test tells its lit item from a layer's on mask 1. */
const POLYGON = 'polygon = PackedVector2Array(0, 0, 4, 0, 4, 4, 0, 4)\nlight_mask = 2';

/** The light mask of every tile layer: the TileMap's default. */
export const LAYER_LIGHT_MASK = 1;

/** A scene whose TileMap carries `tileMapLines` below its heading. */
function tileMapScene(tileMapLines: string): string {
  return `[gd_scene format=3]

[ext_resource type="Texture2D" path="${TEXTURE}" id="2"]

[sub_resource type="TileSetAtlasSource" id="atlas1"]
texture = ExtResource("2")
texture_region_size = Vector2i(16, 16)
0:0/0 = 0

[sub_resource type="TileSet" id="ts"]
sources/0 = SubResource("atlas1")

[node name="Root" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
format = 2
${tileMapLines}

[node name="Child" type="Polygon2D" parent="Map"]
${POLYGON}

[node name="After" type="Polygon2D" parent="."]
${POLYGON}
`;
}

/** Renders a TileMap with `tileMapLines`, on a canvas lit by `lighting`. */
export async function renderTileMap(
  tileMapLines: string,
  lighting: CanvasLighting2D = INERT_CANVAS_LIGHTING
) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 32 };
  fake.textures.seed(TEXTURE, texture);
  const scene = new TscnParser().parse(tileMapScene(tileMapLines));
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(scene)}
      loader={fake.loader}
      workspace="2d"
      around={(nodes) => (
        <CanvasLighting2DContext.Provider value={lighting}>{nodes}</CanvasLighting2DContext.Provider>
      )}
    />
  );
  await settleLoads();
  return renderer;
}

type Renderer = Awaited<ReturnType<typeof renderTileMap>>;

/** Every mesh the scene draws: the tile batches of the layers, then the two polygons. */
export function drawnMeshes(renderer: Renderer): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
}

/** The tile batch meshes alone: every mesh but the authored child and the sibling after the TileMap. */
export function tileMeshes(renderer: Renderer): THREE.Mesh[] {
  const polygons = new Set(polygonMeshes(renderer));
  return drawnMeshes(renderer).filter((mesh) => !polygons.has(mesh));
}

/** The authored child's mesh, then the sibling's. */
export function polygonMeshes(renderer: Renderer): THREE.Mesh[] {
  return ['Child', 'After'].map((name) => {
    const group = renderer.scene.findByProps({ name }).instance as THREE.Object3D;
    let found: THREE.Mesh | undefined;
    group.traverse((object) => {
      if (!found && (object as THREE.Mesh).isMesh) found = object as THREE.Mesh;
    });
    if (!found) throw new Error(`expected a mesh under ${name}, got none`);
    return found;
  });
}
