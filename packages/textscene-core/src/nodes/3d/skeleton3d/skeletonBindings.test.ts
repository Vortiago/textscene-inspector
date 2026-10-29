/**
 * The Skeleton3D scene pass over the Live scene tree. `MeshInstance3D::_resolve_skeleton_path`
 * (`mesh_instance_3d.cpp:175-199`) binds a mesh to the Skeleton3D its `skeleton` path names, with
 * `get_node_or_null` on the live tree, so a path binds across an instance border as it does in one file.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnScene } from '../../../parser/types';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { multiplyTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import { bindMeshesToSkeletons } from './skeletonBindings';
import './index';
import '../meshinstance3d/index';
import '../skeleton/copytransformmodifier3d/index';
import '../skeleton/copytransformmodifier3d/index.r3f';

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

/** The skin matrices the pass binds to the node at `path` of `content`'s live tree, with `scenes` loaded. */
function skinAt(
  content: string,
  path = 'Root/Mesh',
  scenes: Readonly<Record<string, string>> = {}
): readonly Transform3D[] | undefined {
  const main = parse(content);
  const loaded = Object.fromEntries(
    Object.entries(scenes).map(([scenePath, text]) => [scenePath, parse(text)])
  );
  return bindMeshesToSkeletons(liveTreeOf(main.nodes, contextOver(main, loaded))).get(path);
}

function parse(content: string): TscnScene {
  return new TscnParser().parse(content);
}

function expectOrigin(transform: Transform3D | undefined, x: number, y: number, z: number): void {
  expect(transform!.origin.x).toBeCloseTo(x, 5);
  expect(transform!.origin.y).toBeCloseTo(y, 5);
  expect(transform!.origin.z).toBeCloseTo(z, 5);
}

describe('the Skeleton3D scene pass in one file', () => {
  it('binds a MeshInstance3D to the Skeleton3D a relative path names, with one matrix a bone', () => {
    const skinMatrices = skinAt(scene('skeleton = NodePath("../Skeleton3D")'));

    expect(skinMatrices).toHaveLength(3);
    // The bone at rest does not move a vertex bound to it.
    expectOrigin(skinMatrices![0], 0, 0, 0);
  });

  it('turns a vertex bound to a posed bone about that bone, as the skin matrix of the bone does', () => {
    const skinMatrices = skinAt(scene('skeleton = NodePath("../Skeleton3D")'));

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

    expect(skinAt(unique)).toHaveLength(3);
    expect(skinAt(nested, 'Root/Skeleton3D/Mesh')).toHaveLength(3);
  });

  it('binds nothing for a MeshInstance3D that writes no skeleton, whose default is empty', () => {
    const child = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${BONES}
[node name="Mesh" type="MeshInstance3D" parent="Skeleton3D"]
`;
    expect(skinAt(child, 'Root/Skeleton3D/Mesh')).toBeUndefined();
  });

  it('binds nothing for an empty skeleton path, or a missing one whose parent is no Skeleton3D', () => {
    expect(skinAt(scene(''))).toBeUndefined();
    expect(skinAt(scene('skeleton = NodePath("")'))).toBeUndefined();
  });

  it('binds nothing for a path that resolves to no node (edge case)', () => {
    expect(skinAt(scene('skeleton = NodePath("../Nothing")'))).toBeUndefined();
    expect(skinAt(scene('skeleton = NodePath("%Nothing")'))).toBeUndefined();
  });

  it('binds nothing for a path to a node that is not a Skeleton3D', () => {
    expect(skinAt(scene('skeleton = NodePath("..")'))).toBeUndefined();
    expect(skinAt(scene('skeleton = NodePath("../..")'))).toBeUndefined();
    expect(skinAt(scene('skeleton = NodePath("../Mesh")'))).toBeUndefined();
  });

  it('binds nothing for an absolute path, which measures from the live SceneTree (edge case)', () => {
    expect(skinAt(scene('skeleton = NodePath("/root/Root/Skeleton3D")'))).toBeUndefined();
  });

  it('binds nothing when the MeshInstance3D sets a skin, which this pass does not read', () => {
    const content = scene('skeleton = NodePath("../Skeleton3D")\nskin = SubResource("Skin_1")').replace(
      '[node name="Root"',
      '[sub_resource type="Skin" id="Skin_1"]\n[node name="Root"'
    );

    expect(skinAt(content)).toBeUndefined();
  });

  it('binds a skeleton with no bones to an empty skin (edge case)', () => {
    expect(skinAt(scene('skeleton = NodePath("../Skeleton3D")', ''))).toEqual([]);
  });

  it('moves every vertex nowhere under show_rest_only', () => {
    const skinMatrices = skinAt(
      scene('skeleton = NodePath("../Skeleton3D")', `${BONES}show_rest_only = true\n`)
    );

    for (const matrix of skinMatrices!) expectOrigin(matrix, 0, 0, 0);
  });

  it('draws a skeleton with rest keys and no pose keys from the identity pose, away from its rest', () => {
    const restOnly = BONES.replace(/bones\/\d\/(position|rotation) = .*\n/g, '');

    const skinMatrices = skinAt(scene('skeleton = NodePath("../Skeleton3D")', restOnly));

    // Posed at the identity, the root sits at the origin and its bind pose is (0, -0.5, 0).
    expectOrigin(skinMatrices![0], 0, -0.5, 0);
  });

  it('is not moved by the transform of the Skeleton3D, which Godot leaves out of the skin', () => {
    const moved = scene(
      'skeleton = NodePath("../Skeleton3D")',
      BONES,
      'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)\n'
    );

    expect(skinAt(moved)).toEqual(skinAt(scene('skeleton = NodePath("../Skeleton3D")')));
  });
});

/** A host scene of `nodes`, with the sub-scenes at `scenePaths` as ExtResource 1, 2 and so on. */
function host(nodes: string, ...scenePaths: string[]): string {
  const resources = scenePaths
    .map((path, i) => `[ext_resource type="PackedScene" path="${path}" id="${i + 1}"]`)
    .join('\n');
  return `[gd_scene format=3]\n${resources}\n[node name="Root" type="Node3D"]\n${nodes}`;
}

/** A sub-scene whose Skeleton3D and bound MeshInstance3D sit below its root `Rig`. */
const RIG = `[gd_scene format=3]
[node name="Rig" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
unique_name_in_owner = true
${BONES}
[node name="Mesh" type="MeshInstance3D" parent="."]
skeleton = NodePath("../Skeleton3D")
`;

/** A sub-scene whose MeshInstance3D names a Skeleton3D two levels up, outside the scene. */
const HOLDER = `[gd_scene format=3]
[node name="Holder" type="Node3D"]
[node name="Mesh" type="MeshInstance3D" parent="."]
skeleton = NodePath("../../Skeleton3D")
`;

describe('the Skeleton3D scene pass across an instance border', () => {
  it('binds a mesh to a skeleton that both sit inside an instanced scene', () => {
    const skin = skinAt(
      host('[node name="Rig" parent="." instance=ExtResource("1")]\n', 'res://rig.tscn'),
      'Root/Rig/Mesh',
      {
        'res://rig.tscn': RIG,
      }
    );

    expect(skin).toEqual(skinAt(scene('skeleton = NodePath("../Skeleton3D")')));
  });

  it('binds a host mesh whose skeleton path enters an instance', () => {
    const content = host(
      '[node name="Rig" parent="." instance=ExtResource("1")]\n[node name="Mesh" type="MeshInstance3D" parent="."]\nskeleton = NodePath("../Rig/Skeleton3D")\n',
      'res://rig.tscn'
    );

    expect(skinAt(content, 'Root/Mesh', { 'res://rig.tscn': RIG })).toHaveLength(3);
  });

  it('binds a host mesh to an instance whose root is the Skeleton3D', () => {
    const skeletonScene = `[gd_scene format=3]\n[node name="Skeleton" type="Skeleton3D"]\n${BONES}`;
    const content = host(
      '[node name="Skel" parent="." instance=ExtResource("1")]\n[node name="Mesh" type="MeshInstance3D" parent="."]\nskeleton = NodePath("../Skel")\n',
      'res://skeleton.tscn'
    );

    expect(skinAt(content, 'Root/Mesh', { 'res://skeleton.tscn': skeletonScene })).toHaveLength(3);
  });

  it('binds a mesh inside an instance whose skeleton path leaves it for the host skeleton', () => {
    const content = host(
      `[node name="Skeleton3D" type="Skeleton3D" parent="."]\n${BONES}[node name="Holder" parent="." instance=ExtResource("1")]\n`,
      'res://holder.tscn'
    );

    expect(skinAt(content, 'Root/Holder/Mesh', { 'res://holder.tscn': HOLDER })).toHaveLength(3);
  });

  it('binds each of two instances of one scene to its own skeleton', () => {
    const rested = `${BONES}show_rest_only = true\n`;
    const content = host(
      `[node name="A" type="Node3D" parent="."]
[node name="Skeleton3D" type="Skeleton3D" parent="A"]
${BONES}[node name="Holder" parent="A" instance=ExtResource("1")]
[node name="B" type="Node3D" parent="."]
[node name="Skeleton3D" type="Skeleton3D" parent="B"]
${rested}[node name="Holder" parent="B" instance=ExtResource("1")]
`,
      'res://holder.tscn'
    );
    const scenes = { 'res://holder.tscn': HOLDER };

    expect(skinAt(content, 'Root/A/Holder/Mesh', scenes)).toEqual(
      skinAt(scene('skeleton = NodePath("../Skeleton3D")'))
    );
    expect(skinAt(content, 'Root/B/Holder/Mesh', scenes)).toEqual(
      skinAt(scene('skeleton = NodePath("../Skeleton3D")', rested))
    );
  });

  it('reads a %Name inside an instance from the instance table, which the host does not see', () => {
    const rigWithUniquePath = RIG.replace('NodePath("../Skeleton3D")', 'NodePath("%Skeleton3D")');
    const content = host(
      '[node name="Rig" parent="." instance=ExtResource("1")]\n[node name="Mesh" type="MeshInstance3D" parent="."]\nskeleton = NodePath("%Skeleton3D")\n',
      'res://rig.tscn'
    );
    const scenes = { 'res://rig.tscn': rigWithUniquePath };

    expect(skinAt(content, 'Root/Rig/Mesh', scenes)).toHaveLength(3);
    expect(skinAt(content, 'Root/Mesh', scenes)).toBeUndefined();
  });

  it('reads a %Name on an instance root from the table the instance owns', () => {
    const body = `[gd_scene format=3]
[node name="Body" type="MeshInstance3D"]
skeleton = NodePath("%Skeleton3D")
[node name="Skeleton3D" type="Skeleton3D" parent="."]
unique_name_in_owner = true
${BONES}`;
    const content = host('[node name="Body" parent="." instance=ExtResource("1")]\n', 'res://body.tscn');

    expect(skinAt(content, 'Root/Body', { 'res://body.tscn': body })).toHaveLength(3);
  });

  it('binds nothing while the instanced scene is not loaded', () => {
    const content = host('[node name="Rig" parent="." instance=ExtResource("1")]\n', 'res://rig.tscn');

    expect(skinAt(content, 'Root/Rig/Mesh')).toBeUndefined();
  });

  it('binds nothing below a cyclic instance, which stays a leaf (edge case)', () => {
    const loop = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://loop.tscn" id="1"]
[node name="Loop" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${BONES}[node name="Inner" parent="." instance=ExtResource("1")]
`;
    const meshNaming = (path: string) =>
      host(
        `[node name="Loop" parent="." instance=ExtResource("1")]\n[node name="Mesh" type="MeshInstance3D" parent="."]\nskeleton = NodePath("${path}")\n`,
        'res://loop.tscn'
      );
    const scenes = { 'res://loop.tscn': loop };

    expect(skinAt(meshNaming('../Loop/Skeleton3D'), 'Root/Mesh', scenes)).toHaveLength(3);
    expect(skinAt(meshNaming('../Loop/Inner/Skeleton3D'), 'Root/Mesh', scenes)).toBeUndefined();
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

/** The skeleton of `BONES`, a mesh bound to it and `modifier` under it, with `extra` nodes at the root. */
function modified(modifier: string, bones = BONES, extra = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${bones}
[node name="Copy" type="CopyTransformModifier3D" parent="Skeleton3D"]
${modifier}
${extra}[node name="Mesh" type="MeshInstance3D" parent="."]
skeleton = NodePath("../Skeleton3D")
`;
}

/** Equal to 5 places: the copy normalises the rotation the twin writes unnormalised. */
function expectSkinClose(actual: readonly Transform3D[], expected: readonly Transform3D[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((matrix, bone) => {
    for (const row of ['basis_x', 'basis_y', 'basis_z', 'origin'] as const) {
      for (const axis of ['x', 'y', 'z'] as const)
        expect(matrix[row][axis]).toBeCloseTo(expected[bone]![row][axis], 5);
    }
  });
}

const COPY_B2_ROTATION_TO_B1 = `setting_count = 1
settings/0/apply_bone_name = "b1"
settings/0/reference_bone_name = "b2"
settings/0/copy = 2
settings/0/relative = false
`;

describe('the Skeleton3D scene pass with a SkeletonModifier3D child', () => {
  /** `BONES` with the rotation of b2 also on b1, which is what the modifier above makes of the pose. */
  const COPIED_BONES = BONES.replace(
    'bones/1/position = Vector3(0, -0.2, 0)\n',
    'bones/1/position = Vector3(0, -0.2, 0)\nbones/1/rotation = Quaternion(0, 0, 0.5, 0.866025)\n'
  );

  it('skins the pose the modifier makes, as a skeleton written with that pose does', () => {
    const skin = skinAt(modified(COPY_B2_ROTATION_TO_B1));

    expectSkinClose(skin!, skinAt(modified('active = false', COPIED_BONES))!);
    expect(skin).not.toEqual(skinAt(modified('active = false')));
  });

  it('skins the file pose where the modifier is not active', () => {
    expect(skinAt(modified(`active = false\n${COPY_B2_ROTATION_TO_B1}`))).toEqual(
      skinAt(scene('skeleton = NodePath("../Skeleton3D")'))
    );
  });

  it('skins the rest where show_rest_only is on, whatever the modifier does', () => {
    const skin = skinAt(modified(COPY_B2_ROTATION_TO_B1, `${BONES}show_rest_only = true\n`));

    for (const matrix of skin!) expectOrigin(matrix, 0, 0, 0);
  });

  it('reads a reference node in the global space of the scene', () => {
    const copyNodePosition = `setting_count = 1
settings/0/apply_bone_name = "b1"
settings/0/reference_type = 1
settings/0/reference_node = NodePath("../../Target")
settings/0/copy = 1
settings/0/relative = false
`;
    const target = `[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
`;
    // The Target sits at (1, 0, 0) and the parent of b1 at (0, 0.5, 0), so b1 lands at (1, -0.5, 0) below it.
    const twin = BONES.replace(
      'bones/1/position = Vector3(0, -0.2, 0)',
      'bones/1/position = Vector3(1, -0.5, 0)'
    );

    expectSkinClose(
      skinAt(modified(copyNodePosition, BONES, target))!,
      skinAt(modified('active = false', twin))!
    );
  });

  it('reads a reference node where a RemoteTransform3D moved it', () => {
    const copyNodePosition = `setting_count = 1
settings/0/apply_bone_name = "b1"
settings/0/reference_type = 1
settings/0/reference_node = NodePath("../../Target")
settings/0/copy = 1
settings/0/relative = false
`;
    const movedTarget = `[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
remote_path = NodePath("../Target")
`;
    // The relay puts the Target at (3, 0, 0), so b1 lands at (3, -0.5, 0) below its parent.
    const twin = BONES.replace(
      'bones/1/position = Vector3(0, -0.2, 0)',
      'bones/1/position = Vector3(3, -0.5, 0)'
    );

    expectSkinClose(
      skinAt(modified(copyNodePosition, BONES, movedTarget))!,
      skinAt(modified('active = false', twin))!
    );
  });

  it('hands back the same skin where a later load leaves the inputs as they are', () => {
    const main = parse(modified(COPY_B2_ROTATION_TO_B1));
    const skinOfLoad = () =>
      bindMeshesToSkeletons(liveTreeOf(main.nodes, contextOver(main, {}))).get('Root/Mesh');

    expect(skinOfLoad()).toBe(skinOfLoad());
  });
});
