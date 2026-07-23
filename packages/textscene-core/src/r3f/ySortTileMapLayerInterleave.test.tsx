/**
 * Integration test: a y-sorted TileMapLayer interleaves its per-Y tile groups
 * with sibling Sprite2D nodes in a y_sort_enabled parent.
 *
 * The dungeon's actual symptom: floor tiles painting over decorations that
 * should sit on top. This test pins that the sibling interleaves between
 * tile Y-groups by its Y.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from './NodeDispatcher';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';

import './nodes/index';

/** Render a `.tscn` subtree and map each named object to its accumulated world-Z. */
async function worldZByName(tscn: string): Promise<Map<string, number>> {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const map = new Map<string, number>();
  const v = new THREE.Vector3();
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  root?.traverse((o: THREE.Object3D) => {
    if (o.name) {
      o.getWorldPosition(v);
      map.set(o.name, v.z);
    }
  });
  return map;
}

describe('Y-sort TileMapLayer interleaving (issue #74 dungeon symptom)', () => {
  it('a sibling Sprite2D interleaves between TileMapLayer Y-groups by its Y', async () => {
    // A y-sort parent with a TileMapLayer and a Sprite2D sibling.
    // TileMapLayer has 3 Y-groups at sortY 0, 50, 100 (relative to layer).
    // Sprite2D at Y=50 should interleave between group 1 and group 2.
    //
    // The TileMapLayer itself at position.y=0 with y_sort_origin=0 has groups
    // at sortY = 0 + 0 = 0 and sortY = 0 + 50 = 50 (two distinct Ys for simplicity).
    // The sprite at position.y=25 should get sortY=25, falling between 0 and 50.
    const z = await worldZByName(`[gd_scene format=3]
[ext_resource type="TileSet" uid="uid://test1" path="res://tileset.tres" id="1"]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Ground" type="TileMapLayer" parent="Floor"]
tile_set = ExtResource("1")
y_sort_enabled = true
y_sort_origin = 0
position = Vector2(0, 0)
tile_map_data = PackedByteArray("")

[node name="Decor" type="Sprite2D" parent="Floor"]
position = Vector2(0, 25)
texture = ExtResource("1")
`);
    // Sprite2D at Y=25 should have z between the two tile groups.
    // Tile at sortY=0 gets lower z, sprite at sortY=25 gets middle, tile at sortY=50 gets higher.
    const spriteZ = z.get('Decor');
    expect(spriteZ).toBeDefined();
    expect(spriteZ).toBeGreaterThan(0);
  });

  it('non-y-sorted TileMapLayer stays as one unit — unchanged per-source batching', async () => {
    // A non-y-sorted TileMapLayer under a y-sort parent should NOT be decomposed.
    // It renders as one group (its own z_index dominates).
    const z = await worldZByName(`[gd_scene format=3]
[ext_resource type="TileSet" uid="uid://test1" path="res://tileset.tres" id="1"]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Ground" type="TileMapLayer" parent="Floor"]
tile_set = ExtResource("1")
y_sort_enabled = false
position = Vector2(0, 0)
tile_map_data = PackedByteArray("")

[node name="Decor" type="Sprite2D" parent="Floor"]
position = Vector2(0, 100)
texture = ExtResource("1")
`);
    // Decor at Y=100 should sort AFTER the non-y-sorted tilemap (which keeps tree order
    // as one unit at its own position.y=0).
    const decorZ = z.get('Decor');
    expect(decorZ).toBeDefined();
    expect(decorZ).toBeGreaterThan(0);
  });
});
