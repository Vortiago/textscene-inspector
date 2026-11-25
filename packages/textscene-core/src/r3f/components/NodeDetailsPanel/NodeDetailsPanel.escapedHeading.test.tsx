import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderInspector } from './inspector.testkit';

const HUD = `[gd_scene format=3]

[node name="Hud" type="Node3D"]
`;

const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://hud.tscn" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]

[editable path="HudInstance"]
`;

describe('<NodeDetailsPanel> a node seated outside the instance its heading walked into', () => {
  it('shows the node at its new path', async () => {
    await renderInspector(HOST, 'Main/Lamp/Shade', {
      files: { 'res://hud.tscn': HUD },
      // The tree's walk loads the instance Shade's heading walks into. A lookup of Shade alone does not yet.
      loadFirst: ['Main/HudInstance'],
    });

    expect(screen.getByRole('heading', { name: 'Shade' })).toBeTruthy();
    expect(screen.getByText('Main/Lamp/Shade')).toBeTruthy();
  });
});
