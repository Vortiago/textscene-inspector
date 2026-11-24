import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { expandAllRows, renderSceneTree, rowAt, rowPaths } from './sceneTree.testkit';

/** `res://a.tscn`: a root with two children that each instance `res://a.tscn`, both editable. */
const SELF_SCENE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://a.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="A" parent="." instance=ExtResource("1")]

[node name="B" parent="." instance=ExtResource("1")]

[editable path="A"]

[editable path="B"]
`;

async function renderSelfInstancing() {
  const { scene } = await renderSceneTree(SELF_SCENE, {
    files: { 'res://a.tscn': SELF_SCENE },
    rootScenePath: 'res://a.tscn',
  });
  await expandAllRows(scene);
}

// Godot 4.6.3 refuses both ext_resources and lists Root alone (measured). Each instance here stays a leaf.
describe('<SceneTreeViewer> cyclic instancing', () => {
  it('expands every row once, ending at the instances of their own scene', async () => {
    await renderSelfInstancing();

    expect(rowPaths()).toEqual(['Root', 'Root/A', 'Root/B']);
  });

  it('shows a cyclic instance as a leaf row, with no chevron', async () => {
    await renderSelfInstancing();

    const header = rowAt('Root/A')!.querySelector('[role="treeitem"]')!;
    expect(header.getAttribute('aria-expanded')).toBeNull();
    expect(header.textContent).toContain('•');
  });

  it('ends a search that matches a cyclic instance', async () => {
    await renderSelfInstancing();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'b' } });

    expect(rowPaths()).toEqual(['Root', 'Root/B']);
  });
});
