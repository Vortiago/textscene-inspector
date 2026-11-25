import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderInspector } from './inspector.testkit';

const HOLDER = `[gd_scene format=3]

[node name="Holder" type="Node2D"]

[node name="Target" type="Polygon2D" parent="."]

[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
remote_path = NodePath("../Target")
`;

const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://holder.tscn" id="1_holder"]

[node name="Root" type="Node2D"]

[node name="Inst" parent="." instance=ExtResource("1_holder")]
`;

describe('<NodeDetailsPanel> over a RemoteTransform2D target', () => {
  it('shows the position the relay pushed onto a node inside an instance', async () => {
    await renderInspector(HOST, 'Root/Inst/Target', { files: { 'res://holder.tscn': HOLDER } });

    expect(await screen.findByText('300.0')).toBeTruthy();
    expect(screen.getByText('200.0')).toBeTruthy();
  });
});
