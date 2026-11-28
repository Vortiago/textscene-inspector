import { describe, expect, it } from 'vitest';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import { TscnParser } from '../../../../parser/TscnParser';
import { liveTreeOf } from '../../../../r3f/liveSceneTree';
import { contextOver, liveTreeOfText, runPass } from '../../../../r3f/liveSceneTree.testkit';
import { liveGlobalTransform3D } from '../../../../r3f/liveGlobalTransform';
import { bindMeshesToSkeletons } from '../../skeleton3d/skeletonBindings';
import { seatBoneAttachments } from './boneAttachmentSeats';

const riders = readFixture('unit-bone-attachment-3d-follow.tscn').replace(
  'bone_idx = 5',
  'bone_idx = 5\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.8, 0.3, 0.2)'
);
const drivingRider = riders
  .replace('bone_idx = 5', 'bone_idx = 5\noverride_pose = true')
  .replace('bones/5/position = Vector3(0, -0.2, 0)', 'bones/5/position = Vector3(0.24, -0.2, 0.1)')
  .replace('bones/5/rotation = Quaternion(0, 0, 0, 1)', 'bones/5/rotation = Quaternion(0, 0, 1, 0)')
  .replace('bones/5/scale = Vector3(1, 1, 1)', 'bones/5/scale = Vector3(2, 3, 4)');
const riderPath = 'Root/Rig/Skeleton3D/GreenRider';

function host(writes: string, scene = 'riders') {
  return `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://${scene}.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("1")]
[node name="GreenRider" parent="Rig/Skeleton3D" index="0"]
${writes}
[editable path="Rig"]`;
}

function measuredSeat(writes: string, base = riders) {
  const tree = liveTreeOfText(host(writes), { 'res://riders.tscn': base });
  const seat = runPass(seatBoneAttachments, tree).get(riderPath);
  return { bone: seat?.bone, global: seat?.global ?? liveGlobalTransform3D(tree, riderPath) };
}

describe('a BoneAttachment3D in an instanced scene', () => {
  it.each([
    ['bone_idx = 3', 3, 0.173205, 0],
    ['bone_idx = 99', 5, 0.519615, -0.2],
    ['bone_name = "b2"', 2, 0, 0.1],
    ['bone_name = "b2"\nbone_idx = 4', 4, 0.34641, -0.1],
    ['bone_idx = 4\nbone_name = "b2"', 2, 0, 0.1],
    ['bone_idx = 4\nbone_idx = 99', 4, 0.34641, -0.1],
  ] as const)('applies %s when the skeleton exists', (writes, bone, x, y) => {
    const seat = measuredSeat(writes);
    expect(seat.bone).toBe(bone);
    expect(seat.global).toEqual({
      basis_x: { x: expect.closeTo(0.5, 5), y: expect.closeTo(-0.866026, 5), z: 0 },
      basis_y: { x: expect.closeTo(0.866026, 5), y: expect.closeTo(0.5, 5), z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: expect.closeTo(x, 5), y: expect.closeTo(y, 5), z: 0 },
    });
  });

  it('keeps the authored transform when the override names a missing bone', () => {
    const seat = measuredSeat('bone_name = "zz"');
    expect(seat.bone).toBeUndefined();
    expect(seat.global?.origin).toEqual({ x: 0.8, y: 0.3, z: 0.2 });
  });

  it('resets the driven bone to its local rest under its posed parent', () => {
    const seat = measuredSeat('override_pose = false', drivingRider);
    expect(seat.global?.origin).toEqual({ x: expect.closeTo(0.519615, 5), y: expect.closeTo(-0.2, 5), z: 0 });
  });

  it('resets the bone of the shared skin before another setter selects a different bone', () => {
    const tree = liveTreeOfText(host('override_pose = false\nbone_idx = 4'), {
      'res://riders.tscn': drivingRider,
    });
    const matrices = runPass(bindMeshesToSkeletons, tree).get('Root/Rig/Ribbon')!.matrices;
    const control = liveTreeOfText(host(''), { 'res://riders.tscn': riders });
    expect(matrices).toEqual(runPass(bindMeshesToSkeletons, control).get('Root/Rig/Ribbon')!.matrices);
  });
});

describe('successive attachment overrides', () => {
  it("keeps the index setter's bone name when an enclosing instance writes an invalid index", () => {
    const inherited = host('bone_idx = 4');
    const outer = host('bone_idx = 99', 'middle').replace(
      'parent="Rig/Skeleton3D"',
      'parent="Rig/Rig/Skeleton3D"'
    );
    const tree = liveTreeOfText(outer, { 'res://middle.tscn': inherited, 'res://riders.tscn': riders });
    const seat = runPass(seatBoneAttachments, tree).get('Root/Rig/Rig/Skeleton3D/GreenRider');
    expect(seat?.bone).toBe(4);
  });

  it('reads the bone name on the skeleton selected at the index setter', () => {
    const alternate =
      riders +
      `
[node name="Other" type="Skeleton3D" parent="."]
bones/0/name = "b4"
bones/0/position = Vector3(7, 8, 9)
`;
    const writes =
      'bone_idx = 4\nuse_external_skeleton = true\nexternal_skeleton = NodePath("../../Other")\nbone_idx = 99';
    const seat = measuredSeat(writes, alternate);
    expect(seat.bone).toBe(0);
    expect(seat.global?.origin).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('leaves another instance of the same skeleton in its own pose', () => {
    const scene =
      host('override_pose = false') + '\n[node name="Other" parent="." instance=ExtResource("1")]';
    const tree = liveTreeOfText(scene, { 'res://riders.tscn': drivingRider });
    const skins = runPass(bindMeshesToSkeletons, tree);
    expect(skins.get('Root/Rig/Ribbon')!.matrices[5]).not.toEqual(
      skins.get('Root/Other/Ribbon')!.matrices[5]
    );
  });
});

it('stores the properties of an instance root before the loader gives it a parent', () => {
  const base =
    '[gd_scene format=3]\n[node name="Grip" type="BoneAttachment3D"]\nbone_name = "b0"\nbone_idx = 0';
  const main = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://grip.tscn" id="1"]
[node name="Skeleton" type="Skeleton3D"]
bones/0/name = "b0"
bones/0/position = Vector3(1, 2, 3)
bones/1/name = "b1"
bones/1/position = Vector3(4, 5, 6)
[node name="Grip" parent="." instance=ExtResource("1")]
bone_name = "b1"`;
  const tree = liveTreeOfText(main, { 'res://grip.tscn': base });
  const seat = runPass(seatBoneAttachments, tree).get('Skeleton/Grip');
  expect(seat?.bone).toBe(0);
  expect(seat?.global.origin).toEqual({ x: 1, y: 2, z: 3 });
});

it('keeps the last local transform when a later setter unbinds the rider', () => {
  const seat = measuredSeat('bone_idx = 4\nbone_name = "zz"');
  expect(seat.global?.origin).toEqual({ x: expect.closeTo(0.34641, 5), y: expect.closeTo(-0.1, 5), z: 0 });
});

it('keeps the reset on an unkeyed part of an animated skin', () => {
  const tree = liveTreeOfText(host('override_pose = false'), { 'res://riders.tscn': drivingRider });
  const control = liveTreeOfText(host(''), { 'res://riders.tscn': riders });
  const skin = (rig: typeof tree) => runPass(bindMeshesToSkeletons, rig).get('Root/Rig/Ribbon')!;
  const animation = new Map([['b5', { position: [{ x: 1, y: 2, z: 3 }] }]]);
  expect(skin(tree).matricesUnder(animation)).toEqual(skin(control).matricesUnder(animation));
});

it('keeps the last parented pose when an external setter already bound the rider', () => {
  const alternate =
    riders +
    `
[node name="Other" type="Skeleton3D" parent="."]
bones/0/name = "b4"
bones/0/position = Vector3(7, 8, 9)
`;
  const seat = measuredSeat(
    'bone_idx = 4\nexternal_skeleton = NodePath("../../Other")\nuse_external_skeleton = true\nbone_idx = 99',
    alternate
  );
  expect(seat.global?.origin).toEqual({ x: expect.closeTo(0.34641, 5), y: expect.closeTo(-0.1, 5), z: 0 });
});

describe('setter side effects while Godot builds the instance', () => {
  const base = `[gd_scene format=3]
[node name="Rig" type="Skeleton3D"]
bones/0/name = "b0"
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
bones/0/position = Vector3(5, 0, 0)
[node name="Driver" type="BoneAttachment3D" parent="."]
bone_idx = 0
override_pose = true
[node name="Follow" type="BoneAttachment3D" parent="."]
bone_idx = 0`;
  const follow = '[node name="Follow" parent="Rig" index="1"]\nbone_idx = 0\nbone_name = "zz"';
  const reset = '[node name="Driver" parent="Rig" index="0"]\noverride_pose = false';
  it.each([
    [follow, reset, 5],
    [reset, follow, 2],
  ] as const)('applies the two headings in file order', (first, second, x) => {
    const main = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("1")]
${first}
${second}
[editable path="Rig"]`;
    const seats = runPass(seatBoneAttachments, liveTreeOfText(main, { 'res://rig.tscn': base }));
    expect(seats.get('Root/Rig/Follow')?.global.origin.x).toBe(x);
    expect(seats.get('Root/Rig/Driver')?.global.origin.x).toBe(x);
  });
});

it.each([
  ['.', '../../../Later'],
  ['Rig', '../../Later'],
])('waits for an external skeleton added under %s', (parent, path) => {
  const base = riders.replace(
    'bone_idx = 5',
    `bone_idx = 5\nuse_external_skeleton = true\nexternal_skeleton = NodePath("${path}")`
  );
  const later = `[node name="Later" type="Skeleton3D" parent="${parent}"]\nbones/0/name = "b2"\nbones/0/position = Vector3(1, 2, 3)`;
  const main = host('bone_name = "b2"').replace('[editable path="Rig"]', later + '\n[editable path="Rig"]');
  const result = runPass(seatBoneAttachments, liveTreeOfText(main, { 'res://riders.tscn': base })).get(
    riderPath
  );
  expect(result?.bone).toBe(5);
  expect(result?.global.origin).toEqual({ x: 0, y: 0, z: 0 });
});

it('keeps a transform written between selecting a bone and unbinding it', () => {
  const writes =
    'bone_idx = 4\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 7, 3)\nbone_name = "zz"';
  expect(measuredSeat(writes).global?.origin).toEqual({ x: 2, y: 7, z: 3 });
});

it('completes a base file before a derived file with shorter headings overrides it', () => {
  const inherit = (name: string, lines: string) => `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://${name}.tscn" id="1"]
[node name="Root" instance=ExtResource("1")]
${lines}`;
  const change = '[node name="GreenRider" parent="Skeleton3D" index="0"]\nbone_idx = ';
  const main = host('', 'derived').split('[node name="GreenRider"')[0]!;
  const tree = liveTreeOfText(main, {
    'res://riders.tscn': riders,
    'res://middle.tscn': inherit('riders', '\n\n\n' + change + '4'),
    'res://derived.tscn': inherit('middle', change + '2'),
  });
  expect(runPass(seatBoneAttachments, tree).get(riderPath)?.bone).toBe(2);
});

it('retains the bone pose read before a later skeleton heading changes a position', () => {
  const main = host('bone_idx = 4\nbone_name = "missing"').replace(
    '[editable path="Rig"]',
    '[node name="Skeleton3D" parent="Rig" index="0"]\nbones/4/position = Vector3(20, 20, 20)\n[editable path="Rig"]'
  );
  const tree = liveTreeOfText(main, { 'res://riders.tscn': riders });
  const seat = runPass(seatBoneAttachments, tree).get(riderPath);
  expect(seat?.global.origin).toEqual({ x: expect.closeTo(0.34641, 5), y: expect.closeTo(-0.1, 5), z: 0 });
});

it('keeps the external skeleton path inherited before its parent changes skeleton', () => {
  const rig = `[gd_scene format=3]
[node name="Rig" type="Node3D"]
[node name="A" type="Skeleton3D" parent="."]
bones/0/name = "tip"
bones/0/position = Vector3(5,0,0)
[node name="B" type="Skeleton3D" parent="."]
bones/0/name = "tip"
bones/0/position = Vector3(9,0,0)
[node name="Parent" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../A")
bone_idx = 0
[node name="Child" type="BoneAttachment3D" parent="Parent"]
use_external_skeleton = true
bone_idx = 0`;
  const main = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("1")]
[node name="Child" parent="Rig/Parent" index="0"]
bone_name = "tip"
[node name="Parent" parent="Rig" index="2"]
external_skeleton = NodePath("../B")
[editable path="Rig"]`;
  const seats = runPass(seatBoneAttachments, liveTreeOfText(main, { 'res://rig.tscn': rig }));
  expect(seats.get('Root/Rig/Parent')?.global.origin.x).toBe(9);
  expect(seats.get('Root/Rig/Parent/Child')?.global.origin.x).toBe(5);
});

it('applies an outer override after an attachment instance root joins its skeleton', () => {
  const grip =
    '[gd_scene format=3]\n[node name="Grip" type="BoneAttachment3D"]\nbone_name = "b5"\nbone_idx = 5';
  const base = riders
    .replace(
      '[sub_resource',
      '[ext_resource type="PackedScene" path="res://grip.tscn" id="grip"]\n[sub_resource'
    )
    .replace(
      /type="BoneAttachment3D" parent="Skeleton3D"\]\nbone_name = "b5"\nbone_idx = 5/,
      'parent="Skeleton3D" instance=ExtResource("grip")]\nbone_idx = 4'
    );
  const tree = liveTreeOfText(host('bone_name = "b2"'), {
    'res://riders.tscn': base,
    'res://grip.tscn': grip,
  });
  expect(runPass(seatBoneAttachments, tree).get(riderPath)?.bone).toBe(2);
});

it.each([
  ['Inside', 'bone_idx = 1\nbone_idx = 99', 1, 9],
  ['../Holder/Inside', 'bone_name = "second"', 0, 5],
] as const)('applies a typed instance heading while its root resolves %s', (path, writes, index, x) => {
  const main = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://holder.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Holder" type="BoneAttachment3D" parent="." instance=ExtResource("1")]
${writes}`;
  const base = `[gd_scene format=3]
[node name="Holder" type="BoneAttachment3D"]
use_external_skeleton = true
external_skeleton = NodePath("${path}")
bone_name = "first"
bone_idx = 0
[node name="Inside" type="Skeleton3D" parent="."]
bones/0/name = "first"
bones/0/position = Vector3(5,0,0)
bones/1/name = "second"
bones/1/position = Vector3(9,0,0)`;
  const tree = liveTreeOfText(main, { 'res://holder.tscn': base });
  const seat = runPass(seatBoneAttachments, tree).get('Root/Holder');
  expect(seat?.bone).toBe(index);
  expect(seat?.global.origin.x).toBe(x);
});

it('resolves the intermediate steps before an external path reaches the skeleton', () => {
  const main = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://pbase.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("1")]
[node name="Child" parent="Rig" index="1"]
bone_name = "second"
[node name="Late" type="Node" parent="Rig"]
[editable path="Rig"]`;
  const base = `[gd_scene format=3]
[node name="Rig" type="Node3D"]
[node name="A" type="Skeleton3D" parent="."]
bones/0/name = "first"
bones/0/position = Vector3(5,0,0)
bones/1/name = "second"
bones/1/position = Vector3(9,0,0)
[node name="Child" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../Late/../A")
bone_name = "first"
bone_idx = 0`;
  const tree = liveTreeOfText(main, { 'res://pbase.tscn': base });
  const seat = runPass(seatBoneAttachments, tree).get('Root/Rig/Child');
  expect(seat?.bone).toBe(0);
  expect(seat?.global.origin.x).toBe(5);
});

it('updates a shared skeleton when replacing the scene that resets it', () => {
  const parse = (text: string) => new TscnParser().parse(text);
  const main = parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://riders.tscn" id="rig"]
[ext_resource type="PackedScene" path="res://loaders.tscn" id="d"]
[node name="Root" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("rig")]
[node name="Drivers" parent="." instance=ExtResource("d")]
[node name="Early" parent="Drivers" index="0"]
override_pose = false
[node name="Skeleton3D" parent="Rig" index="0"]
bones/5/position = Vector3(20,20,20)
[node name="Late" parent="Drivers" index="1"]
override_pose = false
[editable path="Rig"]
[editable path="Drivers"]`);
  const rig = parse(riders);
  const pose = (early: boolean) => {
    const drivers = parse(`[gd_scene format=3]
[node name="Drivers" type="Node3D"]
[node name="Early" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../../Rig/Skeleton3D")
bone_idx = 5
override_pose = ${early}
[node name="Late" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../../Rig/Skeleton3D")
bone_idx = 5
override_pose = ${!early}`);
    const tree = liveTreeOf(
      main.nodes,
      contextOver(main, { 'res://riders.tscn': rig, 'res://loaders.tscn': drivers })
    );
    return runPass(seatBoneAttachments, tree).get(riderPath)?.global.origin;
  };
  expect(pose(true)?.x).toBeCloseTo(-6.974113, 5);
  expect(pose(false)?.x).toBeCloseTo(0.519615, 5);
});
