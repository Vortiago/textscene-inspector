import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { expandAllRows, renderSceneTree, rowAt } from './sceneTree.testkit';

const SUB = `[gd_scene format=3]

[node name="Sub" type="Node3D"]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Inst" parent="." instance=ExtResource("1")]

[node name="Later" type="Node3D" parent="."]
`;

describe('<SceneTreeViewer> row identity', () => {
  it('keeps the element of a later row when an instance row appears before it', async () => {
    let endLoad: (text: string) => void = () => undefined;
    const sub = new Promise<string>((resolve) => (endLoad = resolve));
    const { scene } = await renderSceneTree(MAIN, { files: { 'res://sub.tscn': sub } });
    await expandAllRows(scene);
    const later = rowAt('Main/Later');
    expect(screen.queryByText('Inst')).toBeNull();

    endLoad(SUB);
    await screen.findByText('Inst');

    expect(rowAt('Main/Later')).toBe(later);
  });
});
