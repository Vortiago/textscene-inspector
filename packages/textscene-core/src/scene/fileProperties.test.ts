import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';

const SUB = `[gd_scene format=3]

[node name="SubRoot" type="Node3D"]
visible = false
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="sub"]

[node name="Main" type="Node3D"]

[node name="Lamp" type="OmniLight3D" parent="."]
omni_range = 3.0
light_energy = 2.0

[node name="Inst" parent="." instance=ExtResource("sub")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
editor_description = "moved"
`;

function openMain() {
  return openScene({
    source: MAIN,
    provider: { loadResource: async (path) => (path === 'res://sub.tscn' ? SUB : null) },
  });
}

describe('fileProperties', () => {
  it('lists the names the file sets on a node, in file order', () => {
    expect(openMain().fileProperties('Lamp')).toEqual(['omni_range', 'light_energy']);
  });

  it('lists none for a node the file sets nothing on', () => {
    expect(openMain().fileProperties('.')).toEqual([]);
  });

  it('lists the names the sub-scene sets, then the names the instancing file adds', async () => {
    const scene = openMain();
    await vi.waitFor(() => expect(scene.fileProperties('Inst')).toContain('visible'));

    expect(scene.fileProperties('Inst')).toEqual(['visible', 'transform', 'editor_description']);
  });

  it('throws as getNode does for a path that names no node', () => {
    expect(() => openMain().fileProperties('Gone')).toThrow(/Node not found/);
  });
});
