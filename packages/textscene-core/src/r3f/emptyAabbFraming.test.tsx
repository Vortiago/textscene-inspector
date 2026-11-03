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

describe('every registered GeometryInstance3D type', () => {
  const types = nodeComponentRegistry
    .getAllTypeNames()
    .filter((type) => descendsFromClass(type, 'GeometryInstance3D'));

  it('is covered by this walk', () => {
    expect(types).toContain('CPUParticles3D');
  });

  // A CSG shape draws its own solid, so it frames on that box and not on a point.
  const pointTypes = types.filter((type) => !nodeComponentRegistry.isCsgShape(type));

  it.each(pointTypes)('frames %s with no content as a point at its node origin', async (type) => {
    const target = await framedTarget(sceneBeside(type));

    expect(target.x).toBeCloseTo(3.75, 5);
  });

  it.each(types.filter((type) => nodeComponentRegistry.isCsgShape(type)))(
    'adds %s to the frame beside a box at the origin',
    async (type) => {
      const target = await framedTarget(sceneBeside(type));

      expect(target.x).toBeGreaterThan(0);
    }
  );
});
