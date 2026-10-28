/**
 * The Skeleton3D scene pass, asserted through the public build (`parseTscnContent` → SceneGraph →
 * the MeshInstance3D's properties). `MeshInstance3D::_resolve_skeleton_path` (`mesh_instance_3d.cpp:175-199`)
 * binds a mesh to the Skeleton3D its `skeleton` path names with the automatic skin of that skeleton.
 */

import { describe, expect, it } from 'vitest';
import { parseTscnContent } from '../../../r3f/hooks/useParsedScene';
import { multiplyTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import type { MeshInstance3DProperties } from '../meshinstance3d/types';
// The passes reach the pipeline through the registrations, as in the app.
import './index';
import './index.r3f';
import '../meshinstance3d/index';

const BONES = `bones/0/name = "b0"
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0)
bones/0/position = Vector3(0, 0.5, 0)
bones/1/name = "b1"
bones/1/parent = 0
bones/1/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.2, 0)
bones/1/position = Vector3(0, -0.2, 0)
bones/2/name = "b2"
bones/2/parent = 1
bones/2/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.2, 0)
bones/2/position = Vector3(0, -0.2, 0)
bones/2/rotation = Quaternion(0, 0, 0.5, 0.866025)
`;

function scene(meshProperties: string, skeletonProperties = BONES, skeletonLine = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${skeletonLine}${skeletonProperties}
[node name="Mesh" type="MeshInstance3D" parent="."]
${meshProperties}
`;
}

function meshProperties(content: string): MeshInstance3DProperties {
  const { sceneGraph } = parseTscnContent(content, 'res://test.tscn');
  const node = sceneGraph?.flattenedNodes.find((n) => n.path === 'Root/Mesh');
  if (!node) throw new Error('expected a node at Root/Mesh');
  return node.data.properties as MeshInstance3DProperties;
}

function expectOrigin(transform: Transform3D | undefined, x: number, y: number, z: number): void {
  expect(transform!.origin.x).toBeCloseTo(x, 5);
  expect(transform!.origin.y).toBeCloseTo(y, 5);
  expect(transform!.origin.z).toBeCloseTo(z, 5);
}

describe('the Skeleton3D scene pass', () => {
  it('binds a MeshInstance3D to the Skeleton3D a relative path names, with one matrix a bone', () => {
    const { skinMatrices } = meshProperties(scene('skeleton = NodePath("../Skeleton3D")'));

    expect(skinMatrices).toHaveLength(3);
    // The bone at rest does not move a vertex bound to it.
    expectOrigin(skinMatrices![0], 0, 0, 0);
  });

  it('turns a vertex bound to a posed bone about that bone, as the skin matrix of the bone does', () => {
    const { skinMatrices } = meshProperties(scene('skeleton = NodePath("../Skeleton3D")'));

    // b2 sits at (0, 0.1, 0) and turns 60 degrees: its own joint stays, and the point below it
    // moves to (0.0866, 0.05, 0).
    expectOrigin(multiplyTransform3D(skinMatrices![2]!, translation(0, 0.1, 0)), 0, 0.1, 0);
    expectOrigin(multiplyTransform3D(skinMatrices![2]!, translation(0, 0, 0)), 0.0866025, 0.05, 0);
  });

  it('reaches a Skeleton3D through a %UniqueName and through a child path', () => {
    const unique = scene('skeleton = NodePath("%Skeleton3D")', BONES, 'unique_name_in_owner = true\n');
    const nested = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${BONES}
[node name="Mesh" type="MeshInstance3D" parent="Skeleton3D"]
skeleton = NodePath("..")
`;

    expect(meshProperties(unique).skinMatrices).toHaveLength(3);
    const { sceneGraph } = parseTscnContent(nested, 'res://test.tscn');
    const mesh = sceneGraph?.flattenedNodes.find((n) => n.path === 'Root/Skeleton3D/Mesh');
    expect((mesh!.data.properties as MeshInstance3DProperties).skinMatrices).toHaveLength(3);
  });

  it('binds nothing for a MeshInstance3D that writes no skeleton, whose default is empty', () => {
    const child = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${BONES}
[node name="Mesh" type="MeshInstance3D" parent="Skeleton3D"]
`;
    const { sceneGraph } = parseTscnContent(child, 'res://test.tscn');
    const mesh = sceneGraph?.flattenedNodes.find((n) => n.path === 'Root/Skeleton3D/Mesh');

    expect((mesh!.data.properties as MeshInstance3DProperties).skinMatrices).toBeUndefined();
  });

  it('binds nothing for an empty skeleton path, or a missing one whose parent is no Skeleton3D', () => {
    expect(meshProperties(scene('')).skinMatrices).toBeUndefined();
    expect(meshProperties(scene('skeleton = NodePath("")')).skinMatrices).toBeUndefined();
  });

  it('binds nothing for a path that resolves to no node (edge case)', () => {
    expect(meshProperties(scene('skeleton = NodePath("../Nothing")')).skinMatrices).toBeUndefined();
    expect(meshProperties(scene('skeleton = NodePath("%Nothing")')).skinMatrices).toBeUndefined();
  });

  it('binds nothing for a path to a node that is not a Skeleton3D', () => {
    expect(meshProperties(scene('skeleton = NodePath("..")')).skinMatrices).toBeUndefined();
    expect(meshProperties(scene('skeleton = NodePath("../..")')).skinMatrices).toBeUndefined();
    expect(meshProperties(scene('skeleton = NodePath("../Mesh")')).skinMatrices).toBeUndefined();
  });

  it('binds nothing for an absolute path, which measures from the live SceneTree (edge case)', () => {
    expect(
      meshProperties(scene('skeleton = NodePath("/root/Root/Skeleton3D")')).skinMatrices
    ).toBeUndefined();
  });

  it('binds nothing when the MeshInstance3D sets a skin, which this pass does not read', () => {
    const content = scene('skeleton = NodePath("../Skeleton3D")\nskin = SubResource("Skin_1")').replace(
      '[node name="Root"',
      '[sub_resource type="Skin" id="Skin_1"]\n[node name="Root"'
    );

    expect(meshProperties(content).skinMatrices).toBeUndefined();
  });

  it('binds a skeleton with no bones to an empty skin (edge case)', () => {
    expect(meshProperties(scene('skeleton = NodePath("../Skeleton3D")', '')).skinMatrices).toEqual([]);
  });

  it('moves every vertex nowhere under show_rest_only', () => {
    const { skinMatrices } = meshProperties(
      scene('skeleton = NodePath("../Skeleton3D")', `${BONES}show_rest_only = true\n`)
    );

    for (const matrix of skinMatrices!) expectOrigin(matrix, 0, 0, 0);
  });

  it('draws a skeleton with rest keys and no pose keys from the identity pose, away from its rest', () => {
    const restOnly = BONES.replace(/bones\/\d\/(position|rotation) = .*\n/g, '');

    const { skinMatrices } = meshProperties(scene('skeleton = NodePath("../Skeleton3D")', restOnly));

    // Posed at the identity, the root sits at the origin and its bind pose is (0, -0.5, 0).
    expectOrigin(skinMatrices![0], 0, -0.5, 0);
  });

  it('is not moved by the transform of the Skeleton3D, which Godot leaves out of the skin', () => {
    const moved = scene(
      'skeleton = NodePath("../Skeleton3D")',
      BONES,
      'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)\n'
    );

    expect(meshProperties(moved).skinMatrices).toEqual(
      meshProperties(scene('skeleton = NodePath("../Skeleton3D")')).skinMatrices
    );
  });
});

function translation(x: number, y: number, z: number): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x, y, z },
  };
}
