/**
 * A GeometryInstance3D whose `get_aabb()` is empty adds a point at its node origin to the bounds
 * Godot frames on (`global_transform * AABB()`), so a scene with one beside a box frames on the
 * span between them. Each case sits at x = 8 beside a unit box at the origin, which Godot frames
 * on x = 3.75 (the box's -0.5 to the point's 8).
 */
import { describe, expect, it } from 'vitest';
import { descendsFromClass } from '../godot/classdb/classBaseTypes';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { framedTarget } from './testing/framedTarget';
import './nodes';

const sceneBeside = (type: string) => `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="Box"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("Box")

[node name="Empty" type="${type}" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
`;

describe('a GeometryInstance3D with an empty AABB', () => {
  it.each([
    'CPUParticles3D',
    'GPUParticles3D',
    'MeshInstance3D',
    'MultiMeshInstance3D',
    'Sprite3D',
    'AnimatedSprite3D',
    'Label3D',
  ])('frames a %s as a point at its node origin', async (type) => {
    const target = await framedTarget(sceneBeside(type));

    expect(target.x).toBeCloseTo(3.75, 5);
  });
});

describe('every registered GeometryInstance3D type', () => {
  const types = nodeComponentRegistry
    .getAllTypeNames()
    .filter((type) => descendsFromClass(type, 'GeometryInstance3D'));

  it('is covered by this walk', () => {
    expect(types).toContain('CPUParticles3D');
  });

  it.each(types)('adds %s to the frame beside a box at the origin', async (type) => {
    const target = await framedTarget(sceneBeside(type));

    expect(target.x).toBeGreaterThan(0);
  });
});
