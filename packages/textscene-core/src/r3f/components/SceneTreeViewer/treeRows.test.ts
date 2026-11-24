import { describe, expect, it, vi } from 'vitest';
import '../../sceneLiveTree.js';
import { openScene, type Scene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { treeRowsOf, type TreeRow } from './treeRows';

const rowsOf = (scene: Scene) => treeRowsOf(scene.getNode('.'));

const SUB = `[gd_scene format=3]

[node name="Sub" type="Node3D"]

[node name="Inner" type="Node3D" parent="."]
`;

const BASE = `[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="BaseChild" type="Node3D" parent="."]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Plain" parent="." instance=ExtResource("1")]

[node name="Editable" parent="." instance=ExtResource("1")]

[node name="Panel" type="Control" parent="."]

[node name="Layer" type="CanvasLayer" parent="."]

[node name="Port" type="SubViewport" parent="."]

[node name="Timer" type="Timer" parent="."]

[editable path="Editable"]
`;

const INHERITING = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Base" instance=ExtResource("1")]

[node name="Added" type="Node3D" parent="."]
`;

const FILES: Record<string, string> = { 'res://sub.tscn': SUB, 'res://base.tscn': BASE };
const provider: ResourceProvider = { loadResource: async (path) => FILES[path] ?? null };

async function loaded(source: string, deepest: string): Promise<Scene> {
  const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
  await vi.waitFor(() => expect(scene.getNodeOrNull(deepest)).not.toBeNull());
  return scene;
}

const names = (row: TreeRow): unknown => ({ [row.name]: row.children.map(names) });
const rowAt = (row: TreeRow, path: string): TreeRow | undefined =>
  row.path === path ? row : row.children.map((child) => rowAt(child, path)).find(Boolean);

// The rows Godot 4.6.3's Scene dock lists, from `get_owner` and `is_editable_instance` (measured).
describe('treeRowsOf', () => {
  it("lists an editable instance's children and hides a plain instance's", async () => {
    const scene = await loaded(MAIN, 'Editable/Inner');
    const root = await rowsOf(scene);
    expect(names(root)).toEqual({
      Main: [
        { Plain: [] },
        { Editable: [{ Inner: [] }] },
        { Panel: [] },
        { Layer: [] },
        { Port: [] },
        { Timer: [] },
      ],
    });
  });

  it('lists the base nodes of an inherited scene under its edited root', async () => {
    const scene = await loaded(INHERITING, 'BaseChild');
    expect(names(await rowsOf(scene))).toEqual({ Base: [{ BaseChild: [] }, { Added: [] }] });
  });

  it('gives each row its live path, its class and the scene file of an instance below the root', async () => {
    const scene = await loaded(MAIN, 'Editable/Inner');
    const root = await rowsOf(scene);
    expect(root).toMatchObject({ path: 'Main', type: 'Node3D', sceneFilePath: '' });
    expect(rowAt(root, 'Main/Plain')).toMatchObject({ type: 'Node3D', sceneFilePath: 'res://sub.tscn' });
    expect(rowAt(root, 'Main/Editable/Inner')).toMatchObject({ sceneFilePath: '' });
  });

  it.each([
    ['Main/Plain', 'Node3D', false],
    ['Main/Panel', 'CanvasItem', false],
    ['Main/Layer', 'CanvasLayer', false],
    ['Main/Port', null, true],
    ['Main/Timer', null, false],
  ])('reads %s as the eye chain %s, a Viewport %s', async (path, chain, isViewport) => {
    const scene = await loaded(MAIN, 'Editable/Inner');
    expect(rowAt(await rowsOf(scene), path)).toMatchObject({ chain, isViewport });
  });
});
