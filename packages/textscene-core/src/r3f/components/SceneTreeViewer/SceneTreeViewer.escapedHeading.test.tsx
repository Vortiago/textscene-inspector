/**
 * A host heading whose `parent=` walk leaves the instance it enters is a row of the node where the
 * walk ends, not of the instance (packed_scene.cpp:157-165).
 */
import { describe, expect, it } from 'vitest';
import { expandAllRows, renderSceneTree, rowAt } from './sceneTree.testkit';

const HUD_PATH = 'res://hud.tscn';

const HUD = `[gd_scene format=3]

[node name="Hud" type="Node3D"]

[node name="Box" type="Node3D" parent="."]
`;

const HOST_PATH = 'res://main1.tscn';

/** HudInstance owns Lamp, outside it, so Shade leaves it. Lamp lists once HudInstance is editable. */
const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${HUD_PATH}" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]

[editable path="HudInstance"]
`;

/** A file that instances the host as `Stage`, so the heading that leaves HudInstance sits in a sub-scene. */
const OUTER = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${HOST_PATH}" id="main1"]

[node name="Outer" type="Node3D"]

[node name="Stage" parent="." instance=ExtResource("main1")]

[editable path="Stage"]
`;

async function renderTree(source = HOST) {
  const { scene } = await renderSceneTree(source, { files: { [HUD_PATH]: HUD, [HOST_PATH]: HOST } });
  await expandAllRows(scene);
}

describe('<SceneTreeViewer> over a heading that leaves its instance', () => {
  it('lists the heading under the node where its walk ends', async () => {
    await renderTree();

    expect(rowAt('Main/Lamp/Shade')).not.toBeNull();
  });

  it('does not list the heading under the instance', async () => {
    await renderTree();

    expect(rowAt('Main/HudInstance/Shade')).toBeNull();
    expect(rowAt('Main/HudInstance/Box')).not.toBeNull();
  });
});

describe('<SceneTreeViewer> over a heading that leaves an instance of an instanced file', () => {
  it('lists the heading under the node where its walk ends, inside the instanced file', async () => {
    await renderTree(OUTER);

    expect(rowAt('Outer/Stage/Lamp/Shade')).not.toBeNull();
  });
});
