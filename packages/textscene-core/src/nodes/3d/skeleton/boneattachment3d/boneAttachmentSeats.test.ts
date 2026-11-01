/**
 * The BoneAttachment3D scene pass over the Live scene tree. `BoneAttachment3D::get_skeleton`
 * (`bone_attachment_3d.cpp:128-142`) reaches the skeleton through the parent or the
 * `external_skeleton` path, `_check_bind` (`:113-126`) resolves the bone, and `on_skeleton_update`
 * (`:294-322`) seats the node on the bone's global pose, with the skeleton's modifiers run first
 * (`skeleton_3d.cpp:336`, `:347`). Each case asserts the global transform `on_skeleton_update`
 * composes, within 1e-5.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../../parser/TscnParser';
import type { TscnScene } from '../../../../parser/types';
import { liveTreeOf } from '../../../../r3f/liveSceneTree';
import { contextOver } from '../../../../r3f/liveSceneTree.testkit';
import { transform3DFromQuaternionScale } from '../../../../godot/math/transform3d';
import type { Quaternion } from '../../../../godot/math/quaternion';
import type { Vector3 } from '../../../../godot/math/vector';
import type { AnimatedPose, BonePose } from '../../skeleton3d/skeletonPose';
import { bindMeshesToSkeletons, posedSkeletonOf } from '../../skeleton3d/skeletonBindings';
import { seatBoneAttachments, type BoneAttachmentSeat } from './boneAttachmentSeats';
import './index';
import '../../skeleton3d/index';
import '../copytransformmodifier3d/index';
import '../copytransformmodifier3d/index.r3f';
import '../../meshinstance3d/index';

/**
 * The two bones the case scenes pose: b0 at the pose (0, 1.5, 0), away from its rest (0, 1, 0),
 * and b1, whose pose turns 90 degrees about Z away from a translation-only rest (0.5, 1, 0). Each
 * bone's global pose, its global rest and the disabled pose all read as distinct numbers, the
 * same way `on_skeleton_update` composes them from `get_bone_global_pose`.
 */
const BONES = `bones/0/name = "b0"
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
bones/0/position = Vector3(0, 1.5, 0)
bones/1/name = "b1"
bones/1/parent = 0
bones/1/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 1, 0)
bones/1/position = Vector3(0.5, 1, 0)
bones/1/rotation = Quaternion(0, 0, 0.7071068, 0.7071068)
`;

/** The skeleton's authored global: a translation at (1, 2, 3), which an external seat composes. */
const SKELETON = 'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)\n';

/** The scene of a parented BoneAttachment3D `Seat` under the skeleton, holding `properties`. */
function parentedScene(properties: string, skeletonLines = '', extraNodes = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${SKELETON}${skeletonLines}${BONES}[node name="Seat" type="BoneAttachment3D" parent="Skeleton3D"]
${properties}${extraNodes}`;
}

/** The scene of a `Holder` at (10, 0, 0), an external `Ext` and a no-external `Loose` under it. */
function holderScene(ext: string, loose = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${SKELETON}${BONES}[node name="Holder" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)
[node name="Ext" type="BoneAttachment3D" parent="Holder"]
use_external_skeleton = true
external_skeleton = NodePath("../../Skeleton3D")
${ext}${loose}`;
}

function parse(content: string): TscnScene {
  return new TscnParser().parse(content);
}

/** What the pass seats at `path` of `content`'s live tree, with `scenes` loaded. */
function seatAt(
  content: string,
  path: string,
  scenes: Readonly<Record<string, string>> = {}
): BoneAttachmentSeat | undefined {
  const main = parse(content);
  const loaded = Object.fromEntries(
    Object.entries(scenes).map(([scenePath, text]) => [scenePath, parse(text)])
  );
  return seatBoneAttachments(liveTreeOf(main.nodes, contextOver(main, loaded))).get(path);
}

/**
 * The turn about Z the case bones pose: a quarter turn. `turnedBasis` reads each step of it through
 * the pose model's own quaternion basis, which the skinned goldens hold against Godot's
 * `Basis(Quaternion)`.
 */
function turnedBasis(
  quarter: number
): [number, number, number, number, number, number, number, number, number] {
  const turn =
    quarter === 0
      ? { x: 0, y: 0, z: 0, w: 1 }
      : quarter === 2
        ? { x: 0, y: 0, z: 1, w: 0 }
        : { x: 0, y: 0, z: 0.7071068 * Math.sign(quarter), w: 0.7071068 };
  const basis = transform3DFromQuaternionScale(turn, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 });
  return [
    basis.basis_x.x,
    basis.basis_x.y,
    basis.basis_x.z,
    basis.basis_y.x,
    basis.basis_y.y,
    basis.basis_y.z,
    basis.basis_z.x,
    basis.basis_z.y,
    basis.basis_z.z,
  ];
}

/** Asserts the global transform `seat` composes: a `quarter`-turn basis and the origin, at 1e-5. */
function expectGlobal(seat: BoneAttachmentSeat, quarter: number, x: number, y: number, z: number): void {
  const rows = turnedBasis(quarter);
  expect(seat.global.origin.x).toBeCloseTo(x, 5);
  expect(seat.global.origin.y).toBeCloseTo(y, 5);
  expect(seat.global.origin.z).toBeCloseTo(z, 5);
  expect(seat.global.basis_x.x).toBeCloseTo(rows[0]!, 5);
  expect(seat.global.basis_x.y).toBeCloseTo(rows[1]!, 5);
  expect(seat.global.basis_x.z).toBeCloseTo(rows[2]!, 5);
  expect(seat.global.basis_y.x).toBeCloseTo(rows[3]!, 5);
  expect(seat.global.basis_y.y).toBeCloseTo(rows[4]!, 5);
  expect(seat.global.basis_y.z).toBeCloseTo(rows[5]!, 5);
  expect(seat.global.basis_z.x).toBeCloseTo(rows[6]!, 5);
  expect(seat.global.basis_z.y).toBeCloseTo(rows[7]!, 5);
  expect(seat.global.basis_z.z).toBeCloseTo(rows[8]!, 5);
}

/** Asserts the local transform the seat gives in the file pose, origin at 1e-5. */
function expectLocalOrigin(seat: BoneAttachmentSeat, x: number, y: number, z: number): void {
  const local = seat.localUnder(null);
  expect(local.origin.x).toBeCloseTo(x, 5);
  expect(local.origin.y).toBeCloseTo(y, 5);
  expect(local.origin.z).toBeCloseTo(z, 5);
}

/** The pose a clip writes on the bone `name`, with one track for each part given. */
function posing(
  name: string,
  parts: { position?: Vector3; rotation?: Quaternion; scale?: Vector3 }
): AnimatedPose {
  const pose: BonePose = {
    ...(parts.position && { position: [parts.position] }),
    ...(parts.rotation && { rotation: [parts.rotation] }),
    ...(parts.scale && { scale: [parts.scale] }),
  };
  return new Map([[name, pose]]);
}

describe('the seat of a parented BoneAttachment3D', () => {
  it('rides bone_idx, which wins over bone_name', () => {
    const seat = seatAt(parentedScene('bone_idx = 1\nbone_name = "b0"\n'), 'Root/Skeleton3D/Seat')!;

    expect(seat.skeletonPath).toBe('Root/Skeleton3D');
    expect(seat.bone).toBe(1);
    // b1's global pose composes under b0's identity: (0.5, 2.5, 0), turned by its own pose.
    expectGlobal(seat, 1, 1.5, 4.5, 3);
    expectLocalOrigin(seat, 0.5, 2.5, 0);
  });

  it('rides the first bone bone_name names, with no bone_idx', () => {
    const seat = seatAt(parentedScene('bone_name = "b1"\n'), 'Root/Skeleton3D/Seat')!;

    expect(seat.bone).toBe(1);
    expectGlobal(seat, 1, 1.5, 4.5, 3);
  });

  it('rides bone_idx with no bone_name', () => {
    const seat = seatAt(parentedScene('bone_idx = 0\n'), 'Root/Skeleton3D/Seat')!;

    expect(seat.bone).toBe(0);
    // b0's global pose sits at (0, 1.5, 0): (1, 3.5, 3) with the skeleton.
    expectGlobal(seat, 0, 1, 3.5, 3);
  });

  it('seats an index past the last bone on the identity, where get_bone_global_pose errs', () => {
    const seat = seatAt(
      parentedScene('bone_idx = 99\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)\n'),
      'Root/Skeleton3D/Seat'
    )!;

    expect(seat.bone).toBe(99);
    // The authored (2, 0, 0) is replaced: the bound index reads the identity pose.
    expectGlobal(seat, 0, 1, 2, 3);
    expectLocalOrigin(seat, 0, 0, 0);
  });

  it('seats a bone_name no bone carries nowhere, so the authored transform stands', () => {
    expect(seatAt(parentedScene('bone_name = "ghost"\n'), 'Root/Skeleton3D/Seat')).toBeUndefined();
  });

  it('replaces the authored transform of a bound bone with its pose', () => {
    const seat = seatAt(
      parentedScene('bone_idx = 0\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 9, 9, 9)\n'),
      'Root/Skeleton3D/Seat'
    )!;

    expectGlobal(seat, 0, 1, 3.5, 3);
    expectLocalOrigin(seat, 0, 1.5, 0);
  });

  it('seats on the rest while show_rest_only is on', () => {
    const seat = seatAt(
      parentedScene('bone_idx = 1\n', `${BONES}show_rest_only = true\n`),
      'Root/Skeleton3D/Seat'
    )!;

    // b1's global rest: (0.5, 2, 0), so (1.5, 4, 3) with the skeleton, at the identity.
    expectGlobal(seat, 0, 1.5, 4, 3);
  });

  it('seats a disabled bone on its own rest under the posed parent', () => {
    const seat = seatAt(
      parentedScene('bone_idx = 1\n', `${BONES}bones/1/enabled = false\n`),
      'Root/Skeleton3D/Seat'
    )!;

    // b0 stays posed at (0, 1.5, 0) and b1 takes its rest (0.5, 1, 0): the same origin the posed
    // seat reads, at the rest's identity basis.
    expectGlobal(seat, 0, 1.5, 4.5, 3);
  });

  it('seats on the pose the skeleton modifiers leave, not the file pose', () => {
    const modifier = `[node name="Copy" type="CopyTransformModifier3D" parent="Skeleton3D"]
setting_count = 1
settings/0/apply_bone_name = "b0"
settings/0/reference_bone_name = "b1"
settings/0/copy = 2
settings/0/relative = false
`;
    const seat = seatAt(parentedScene('bone_idx = 1\n', '', modifier), 'Root/Skeleton3D/Seat')!;

    // The modifier puts its own turn on b0, so b1 composes at (−1, 2, 0) instead of (0.5, 2.5, 0):
    // (0, 4, 3) with the skeleton, at a half-turn basis.
    expectGlobal(seat, 2, 0, 4, 3);
  });

  it('seats like a skeleton the file poses with the modifier result, so the pose is read once', () => {
    const modifier = `[node name="Copy" type="CopyTransformModifier3D" parent="Skeleton3D"]
setting_count = 1
settings/0/apply_bone_name = "b0"
settings/0/reference_bone_name = "b1"
settings/0/copy = 2
settings/0/relative = false
`;
    const modified = parentedScene('bone_idx = 1\n', '', modifier);
    const twin = parentedScene(
      'bone_idx = 1\n',
      BONES.replace('bones/1/rest', 'bones/0/rotation = Quaternion(0, 0, 0.7071068, 0.7071068)\nbones/1/rest')
    );

    const seated = seatAt(modified, 'Root/Skeleton3D/Seat')!;
    const written = seatAt(twin, 'Root/Skeleton3D/Seat')!;

    // Equal to 5 places: the copy normalises the rotation the twin writes unnormalised.
    expectGlobal(seated, 2, 0, 4, 3);
    expectGlobal(written, 2, 0, 4, 3);
  });

  it('keeps the authored transform while override_pose is on', () => {
    expect(
      seatAt(parentedScene('bone_idx = 1\noverride_pose = true\n'), 'Root/Skeleton3D/Seat')
    ).toBeUndefined();
  });
});

describe('the seat of an external BoneAttachment3D', () => {
  it('composes the skeleton global with the bone pose, under its own parent', () => {
    const seat = seatAt(holderScene('bone_idx = 1\n'), 'Root/Holder/Ext')!;

    expect(seat.skeletonPath).toBe('Root/Skeleton3D');
    expect(seat.bone).toBe(1);
    // The skeleton's (1, 2, 3) composes with b1's (0.5, 2.5, 0): (1.5, 4.5, 3), at a quarter turn.
    expectGlobal(seat, 1, 1.5, 4.5, 3);
    // The holder's (10, 0, 0) stays out of the seat; the local composes on its inverse.
    expect(seat.localUnder(null).origin.x).toBeCloseTo(-8.5, 5);
    expect(seat.localUnder(null).origin.y).toBeCloseTo(4.5, 5);
  });

  it('seats a sibling with no external skeleton nowhere, so its authored transform stands', () => {
    const loose = `[node name="Loose" type="BoneAttachment3D" parent="Holder"]
bone_name = "b1"
[node name="Loose2" type="BoneAttachment3D" parent="Holder"]
external_skeleton = NodePath("../../Skeleton3D")
`;
    const content = holderScene('bone_idx = 1\n', loose);

    expect(seatAt(content, 'Root/Holder/Ext')).toBeDefined();
    expect(seatAt(content, 'Root/Holder/Loose')).toBeUndefined();
    expect(seatAt(content, 'Root/Holder/Loose2')).toBeUndefined();
  });

  it('takes the external skeleton of a parent BoneAttachment3D for an empty external_skeleton', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${SKELETON}${BONES}[node name="Bridge" type="BoneAttachment3D" parent="Skeleton3D"]
use_external_skeleton = true
external_skeleton = NodePath("..")
bone_idx = 1
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 9, 9, 9)
[node name="Inner" type="BoneAttachment3D" parent="Skeleton3D/Bridge"]
use_external_skeleton = true
bone_idx = 0
`;
    const bridge = seatAt(content, 'Root/Skeleton3D/Bridge')!;
    const inner = seatAt(content, 'Root/Skeleton3D/Bridge/Inner')!;

    // The bridge sits on b1 through its own path, and its authored (9, 9, 9) is gone.
    expectGlobal(bridge, 1, 1.5, 4.5, 3);
    // The inner rides b0 through the bridge's external skeleton, and the seated bridge, not the
    // authored (9, 9, 9), is what its local composes on.
    expectGlobal(inner, 0, 1, 3.5, 3);
    expectLocalOrigin(inner, -1, 0.5, 0);
  });

  it('binds across an instance border with a path that leaves the sub-scene', () => {
    const subScene = `[gd_scene format=3]
[node name="Holder" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0, 0)
[node name="Ext" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../../Skeleton3D")
bone_idx = 1
`;
    const host = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://holder.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
${SKELETON}${BONES}[node name="Holder" parent="." instance=ExtResource("1")]
`;
    const seat = seatAt(host, 'Root/Holder/Ext', { 'res://holder.tscn': subScene })!;

    // The global compose ignores the holder's (20, 0, 0): the seat lands on the bone.
    expectGlobal(seat, 1, 1.5, 4.5, 3);
  });
});

describe('the seat under the bone poses of an animation', () => {
  it('rides the pose a clip writes, as a skeleton written with that pose seats', () => {
    const seat = seatAt(parentedScene('bone_idx = 1\n'), 'Root/Skeleton3D/Seat')!;
    const moved = seat.localUnder(posing('b0', { position: { x: 0, y: 2.5, z: 0 } }));

    // b0's animated pose is (0, 2.5, 0), so b1 composes (0.5, 3.5, 0) under it, and the
    // file-pose global stands as it was.
    expect(moved.origin.x).toBeCloseTo(0.5, 5);
    expect(moved.origin.y).toBeCloseTo(3.5, 5);
    expect(seat.global.origin.x).toBeCloseTo(1.5, 5);
    expect(seat.global.origin.y).toBeCloseTo(4.5, 5);
  });

  it('poses the file again once the clip releases', () => {
    const seat = seatAt(parentedScene('bone_idx = 1\n'), 'Root/Skeleton3D/Seat')!;

    const released = seat.localUnder(null);
    expect(released.origin.x).toBeCloseTo(0.5, 5);
    expect(released.origin.y).toBeCloseTo(2.5, 5);
  });
});

describe('one posed skeleton per live path', () => {
  it('hands the same posed skeleton to every ask of the same skeleton', () => {
    const main = parse(parentedScene('bone_idx = 1\n'));
    const tree = liveTreeOf(main.nodes, contextOver(main, {}));

    expect(posedSkeletonOf(tree.at('Root/Skeleton3D')!, tree)).toBe(
      posedSkeletonOf(tree.at('Root/Skeleton3D')!, tree)
    );
  });

  it('hands the skin pass the same posed skeleton the seat pass reads', () => {
    const main = parse(
      parentedScene(
        'bone_idx = 1\n',
        '[node name="Mesh" type="MeshInstance3D" parent="."]\nskeleton = NodePath("../Skeleton3D")\n'
      )
    );
    const tree = liveTreeOf(main.nodes, contextOver(main, {}));

    const skin = bindMeshesToSkeletons(tree).get('Root/Mesh');
    expect(skin).toBe(posedSkeletonOf(tree.at('Root/Skeleton3D')!, tree).skin);
    expect(skin!.skeletonPath).toBe('Root/Skeleton3D');
  });
});
