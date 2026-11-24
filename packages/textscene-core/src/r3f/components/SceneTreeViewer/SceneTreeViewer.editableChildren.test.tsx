import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fileBytes } from '../../../resources/testing/fileBytes';
import { expandAllRows, renderSceneTree, rowAt, type TreeFiles } from './sceneTree.testkit';

const PLAYER = `[gd_scene format=3]

[node name="PlayerRoot" type="Node3D"]

[node name="Body" type="Node3D" parent="."]
`;

const ENGINE = `[gd_scene format=3]

[node name="EngineRoot" type="Node3D"]

[node name="Nozzle" type="Node3D" parent="."]
`;

const SHIP = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://engine.tscn" id="engine"]

[node name="ShipRoot" type="Node3D"]

[node name="Engine" parent="." instance=ExtResource("engine")]
`;

const CUBE_GLB = fileBytes(
  join(import.meta.dirname, '../../../../../../scenes/fixtures/meshes/unit-cube.glb')
);

const FILES: TreeFiles = {
  'res://player.tscn': PLAYER,
  'res://engine.tscn': ENGINE,
  'res://ship.tscn': SHIP,
  'res://cube.glb': CUBE_GLB,
};

/** Main instances player.tscn with Hat below it, ship.tscn whose Engine is engine.tscn, and cube.glb. */
function mainScene(editablePaths: readonly string[]): string {
  const editables = editablePaths.map((path) => `[editable path="${path}"]`).join('\n\n');
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]
[ext_resource type="PackedScene" path="res://ship.tscn" id="ship"]
[ext_resource type="PackedScene" path="res://cube.glb" id="cube"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Hat" type="Node3D" parent="Player"]

[node name="Ship" parent="." instance=ExtResource("ship")]

[node name="Cube" parent="." instance=ExtResource("cube")]

${editables}
`;
}

/** Renders Main's tree once every instance has loaded, with every row expanded. */
async function renderMain(editablePaths: readonly string[] = []) {
  const { scene } = await renderSceneTree(mainScene(editablePaths), { files: FILES });
  await vi.waitFor(() => expect(scene.getNodeOrNull('Ship/Engine/Nozzle')).not.toBeNull());
  await expandAllRows(scene, 'Cube/Cube');
  return (path: string) => rowAt(path) !== null;
}

// Each listing is what Godot 4.6.3's Scene dock lists from get_owner and is_editable_instance (measured).
describe('the scene tree lists what Godot’s Scene dock lists (scene_tree_editor.cpp:283-290)', () => {
  it('lists an instance as one row while the scene does not make its children editable', async () => {
    const lists = await renderMain();

    expect(lists('Main/Ship')).toBe(true);
    expect(lists('Main/Ship/Engine')).toBe(false);
    expect(lists('Main/Player/Body')).toBe(false);
  });

  it('lists the nodes the instancing scene adds below an instance', async () => {
    const lists = await renderMain();

    expect(lists('Main/Player/Hat')).toBe(true);
  });

  it('lists the nodes of an instance the scene makes editable', async () => {
    const lists = await renderMain(['Player']);

    expect(lists('Main/Player/Body')).toBe(true);
  });

  it('lists a nested instance as one row while only the outer one is editable', async () => {
    const lists = await renderMain(['Ship']);

    expect(lists('Main/Ship/Engine')).toBe(true);
    expect(lists('Main/Ship/Engine/Nozzle')).toBe(false);
  });

  it('lists the nodes of a nested instance the scene makes editable too', async () => {
    const lists = await renderMain(['Ship', 'Ship/Engine']);

    expect(lists('Main/Ship/Engine/Nozzle')).toBe(true);
  });

  it('lists an instanced GLB as one row while the scene does not make it editable', async () => {
    expect((await renderMain())('Main/Cube/Cube')).toBe(false);
  });

  it('lists the objects of an instanced GLB the scene makes editable', async () => {
    expect((await renderMain(['Cube']))('Main/Cube/Cube')).toBe(true);
  });
});
