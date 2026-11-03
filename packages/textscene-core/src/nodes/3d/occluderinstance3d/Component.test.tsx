/**
 * An OccluderInstance3D draws nothing, but its selection box is the `get_aabb` of its occluder
 * (`occluder_instance_3d.cpp:427-432`). The values are measured in Godot 4.6.3,
 * from `get_vertices` of each occluder shape.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { computeWorldBoundingBox } from '../../../r3f/bounds';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { expectSelectionBox } from '../../../r3f/testing/gizmoContract';
import './index';
import './index.r3f';
import '../../base/node3d/index.r3f';

const OccluderInstance3D = nodeComponentRegistry.get('OccluderInstance3D')!;

async function render(resourceType: string | null, lines = '') {
  const resource = resourceType ? `[sub_resource type="${resourceType}" id="Occ_1"]\n${lines}\n` : '';
  const occluder = resourceType ? 'occluder = SubResource("Occ_1")\n' : '';
  const parsed = new TscnParser().parse(
    `[gd_scene format=3]\n\n${resource}[node name="Occluder" type="OccluderInstance3D"]\n${occluder}`
  );
  return ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed}>
      <OccluderInstance3D node={parsed.nodes[0]!} />
    </SceneStack>
  );
}

describe('<OccluderInstance3D> selection box', () => {
  it('is empty with no occluder', async () => {
    expectSelectionBox(await render(null), null);
  });

  it('is the box of a BoxOccluder3D', async () => {
    expectSelectionBox(await render('BoxOccluder3D', 'size = Vector3(4, 2, 6)'), {
      min: [-2, -1, -3],
      max: [2, 1, 3],
    });
  });

  it('is the unit box of a BoxOccluder3D that keeps its default size', async () => {
    expectSelectionBox(await render('BoxOccluder3D'), { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] });
  });

  it('is flat for a QuadOccluder3D', async () => {
    expectSelectionBox(await render('QuadOccluder3D', 'size = Vector2(3, 5)'), {
      min: [-1.5, -2.5, 0],
      max: [1.5, 2.5, 0],
    });
  });

  it('reaches the origin for a PolygonOccluder3D off it', async () => {
    const polygon = 'polygon = PackedVector2Array(1, 1, 5, 1, 5, 4, 1, 4)';
    expectSelectionBox(await render('PolygonOccluder3D', polygon), { min: [0, 0, 0], max: [5, 4, 0] });
  });

  it('is empty for a PolygonOccluder3D whose edges cross', async () => {
    const bowTie = 'polygon = PackedVector2Array(1, 1, 5, 4, 5, 1, 1, 4)';
    expectSelectionBox(await render('PolygonOccluder3D', bowTie), null);
  });

  it('reaches the origin for an ArrayOccluder3D off it', async () => {
    const vertices = 'vertices = PackedVector3Array(1, 2, 3, 4, 5, 6, 2, 3, 9)';
    expectSelectionBox(await render('ArrayOccluder3D', vertices), { min: [0, 0, 0], max: [4, 5, 9] });
  });

  it('is the box of the sphere mesh for a SphereOccluder3D', async () => {
    const renderer = await render('SphereOccluder3D', 'radius = 2.0');
    const box = computeWorldBoundingBox(renderer.scene.instance as THREE.Object3D);
    expect(box.min.x).toBeCloseTo(-1.801938, 5);
    expect(box.max.y).toBeCloseTo(2, 5);
    expect(box.max.z).toBeCloseTo(1.949856, 5);
  });
});
