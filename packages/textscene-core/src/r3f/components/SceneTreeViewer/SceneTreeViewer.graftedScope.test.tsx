import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { expandAllRows, renderSceneTree, rowAt } from './sceneTree.testkit';

// Both files declare ExtResource "2", for a different scene.
const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]
[ext_resource type="PackedScene" path="res://host-leaf.tscn" id="2"]

[node name="Host" type="Control"]

[node name="Sub" parent="." instance=ExtResource("1")]

[node name="Leaf" parent="Sub/Slot" instance=ExtResource("2")]

[editable path="Sub"]
`;

const FILES = {
  'res://sub.tscn': `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub-leaf.tscn" id="2"]

[node name="SubRoot" type="Control"]

[node name="Slot" type="Control" parent="."]
`,
  'res://host-leaf.tscn': '[gd_scene format=3]\n\n[node name="HostLeafRoot" type="Label"]\n',
  'res://sub-leaf.tscn': '[gd_scene format=3]\n\n[node name="SubLeafRoot" type="Button"]\n',
};

describe('<SceneTreeViewer> a node grafted into an instanced sub-scene', () => {
  it('shows the class of the scene its host file names', async () => {
    const { scene } = await renderSceneTree(HOST, { files: FILES });
    await expandAllRows(scene);

    await waitFor(() => expect(rowAt('Host/Sub/Slot/Leaf')!.querySelector('[title="Label"]')).not.toBeNull());
    expect(rowAt('Host/Sub/Slot/Leaf')!.querySelector('[title="Button"]')).toBeNull();
  });
});
