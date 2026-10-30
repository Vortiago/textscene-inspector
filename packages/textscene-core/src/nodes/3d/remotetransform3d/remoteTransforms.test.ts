/**
 * The RemoteTransform scene pass over the Live scene tree. Godot resolves `remote_path` with
 * `get_node` on the live tree (`remote_transform_3d.cpp:35-36`, `remote_transform_2d.cpp:35-36`), so
 * a relay and its target meet across an instance border as they do in one file. The numbers match
 * real Godot 4.6.3 in the ref harness (fixtures unit-remote-transform-3d/2d.tscn).
 */

import { describe, it, expect } from 'vitest';
import { liveTreeOfText } from '../../../r3f/liveSceneTree.testkit';
import { liveGlobalTransform3D } from '../../../r3f/liveGlobalTransform';
import type { NodePatches } from '../../../r3f/nodePatch';
import { decomposeTransform3D } from '../../../utils/transform';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import type { Node2DProperties } from '../../../nodes/base/node2d/types';
import { multiplyTransform2D, transform2DFromParts } from '../../../godot/math/transform2d.js';
import { applyRemoteTransforms } from './remoteTransforms';

/** What the pass binds in `content`'s live tree, with each scene of `scenes` loaded. */
function placementsOf(content: string, scenes: Readonly<Record<string, string>> = {}): NodePatches {
  return applyRemoteTransforms(liveTreeOfText(content, scenes));
}

/** The columns of the global basis and the origin of the node at `path`, after the relays have run. */
function globalPoseOf(content: string, path: string): { columns: number[][]; origin: number[] } {
  const tree = liveTreeOfText(content);
  const global = liveGlobalTransform3D(tree, path, applyRemoteTransforms(tree));
  if (!global) throw new Error(`expected a Node3D at ${path}`);
  const { basis_x: x, basis_y: y, basis_z: z, origin } = global;
  return {
    columns: [
      [x.x, y.x, z.x],
      [x.y, y.y, z.y],
      [x.z, y.z, z.z],
    ],
    origin: [origin.x, origin.y, origin.z],
  };
}

function expectCloseTo(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));
}

function targetTransform3D(placements: NodePatches, path: string) {
  const patch = placements.get(path);
  if (!patch) throw new Error(`expected a placement at ${path}, got ${[...placements.keys()].join(', ')}`);
  return decomposeTransform3D(patch.transform as Transform3D);
}

function targetNode2D(placements: NodePatches, path: string): Node2DProperties {
  const patch = placements.get(path);
  if (!patch) throw new Error(`expected a placement at ${path}, got ${[...placements.keys()].join(', ')}`);
  return patch as unknown as Node2DProperties;
}

describe('applyRemoteTransforms (3D)', () => {
  it('relays through a %UniqueName target', () => {
    // Godot resolves `%TargetCube` through the owner's claim table, so the target lands at +2.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="TargetCube" type="Node3D" parent="."]
unique_name_in_owner = true
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Holder" type="Node3D" parent="."]
[node name="Relay" type="RemoteTransform3D" parent="Holder"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("%TargetCube")
`;
    const { position } = targetTransform3D(placementsOf(content), 'Root/TargetCube');
    expect(position.x).toBeCloseTo(2, 5);
  });

  it('leaves the target alone when nothing claims the unique name', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="TargetCube" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("%TargetCube")
`;
    expect(placementsOf(content).has('Root/TargetCube')).toBe(false);
  });

  it('copies the relay global transform onto the target (default flags)', () => {
    // Relay authored at +2 X, target authored at -2 X, both children of root.
    // Godot renders the target at +2 (measured). Default flags = full copy.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="TargetCube" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../TargetCube")
`;
    const { position } = targetTransform3D(placementsOf(content), 'Root/TargetCube');
    expect(position.x).toBeCloseTo(2, 5);
    expect(position.y).toBeCloseTo(0, 5);
    expect(position.z).toBeCloseTo(0, 5);
  });

  it('with update_rotation/scale disabled, pushes only position and keeps the target rotation & scale', () => {
    // Relay at (5,0,0) with a Y rotation & scale that must not reach the target.
    // Target authored at (1,2,3) with scale 2 and no rotation.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 1, 2, 3)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(0, 0, -3, 0, 3, 0, 3, 0, 0, 5, 0, 0)
remote_path = NodePath("../Target")
update_rotation = false
update_scale = false
`;
    const { position, rotation, scale } = targetTransform3D(placementsOf(content), 'Root/Target');
    expect(position.x).toBeCloseTo(5, 5);
    expect(position.y).toBeCloseTo(0, 5);
    expect(position.z).toBeCloseTo(0, 5);
    // Rotation untouched (target had none), scale preserved at 2.
    expect(rotation.y).toBeCloseTo(0, 5);
    expect(scale.x).toBeCloseTo(2, 5);
    expect(scale.y).toBeCloseTo(2, 5);
    expect(scale.z).toBeCloseTo(2, 5);
  });

  it('global coordinates use the relay WORLD transform under a translated parent', () => {
    // Parent translated +3 X, relay local +2 X ⇒ relay global +5 X.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Offset" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="Offset"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../../Target")
[node name="Target" type="Node3D" parent="."]
`;
    const { position } = targetTransform3D(placementsOf(content), 'Root/Target');
    expect(position.x).toBeCloseTo(5, 5);
  });

  it('with use_global_coordinates = false, leaves the target untouched (static-render no-op)', () => {
    // Measured on Godot 4.6.3 (a matched pair, only the flag differs): the local-coordinate relay
    // does not reposition its target on a static load. The target keeps its authored identity
    // transform, so it stays at the origin, not the relay's +2.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Offset" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="Offset"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../../Target")
use_global_coordinates = false
[node name="Target" type="Node3D" parent="."]
`;
    expect(placementsOf(content).has('Root/Target')).toBe(false);
  });

  it('resolves a relay chain in document order (A drives B, B drives C)', () => {
    // Relay A at +4 drives B. B, itself a relay at authored +1, is driven to +4, then B drives C,
    // so C ends at +4.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="A" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 0, 0)
remote_path = NodePath("../B")
[node name="B" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../C")
[node name="C" type="Node3D" parent="."]
`;
    const placements = placementsOf(content);
    expect(targetTransform3D(placements, 'Root/B').position.x).toBeCloseTo(4, 5);
    expect(targetTransform3D(placements, 'Root/C').position.x).toBeCloseTo(4, 5);
  });

  it('is a graceful no-op when the remote_path resolves to nothing', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../DoesNotExist")
`;
    expect(placementsOf(content).size).toBe(0);
  });

  it('leaves a target that is no Node3D alone, as the cast to Node3D fails (remote_transform_3d.cpp:54)', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node2D" parent="."]
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../Target")
`;
    expect(placementsOf(content).size).toBe(0);
  });
});

describe('applyRemoteTransforms (3D) refuses a target on its own line of the tree', () => {
  // Godot leaves a node alone that is the relay, its ancestor or its descendant
  // (`remote_transform_3d.cpp:37`), so each case below is measured unmoved on Godot 4.6.3.
  it('leaves the parent of the relay where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="Target"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
remote_path = NodePath("..")
`;
    expect(placementsOf(content).size).toBe(0);
  });

  it('leaves the grandparent of the relay where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -3)
[node name="Middle" type="Node3D" parent="Target"]
[node name="Relay" type="RemoteTransform3D" parent="Target/Middle"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
remote_path = NodePath("../..")
`;
    expect(placementsOf(content).size).toBe(0);
  });

  it('leaves the child of the relay where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
remote_path = NodePath("Child")
[node name="Child" type="Node3D" parent="Relay"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 5)
`;
    expect(placementsOf(content).size).toBe(0);
  });

  it('leaves the relay itself where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
remote_path = NodePath(".")
`;
    expect(placementsOf(content).size).toBe(0);
  });
});

/**
 * A target at 45° about Z under a parent scaled (2, 1, 1), and a relay at 45° about Z under a parent
 * scaled (1, 3, 1), whose global origin is (3, 1, 0). The relay's global basis is sheared against the
 * target's. Every expectation below is measured on Godot 4.6.3 (`_update_remote`,
 * `remote_transform_3d.cpp:63-99`).
 */
const shearedScene = (flags: string): string => `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="P" type="Node3D" parent="."]
transform = Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
[node name="Target" type="Node3D" parent="P"]
transform = Transform3D(0.70710678, -0.70710678, 0, 0.70710678, 0.70710678, 0, 0, 0, 1, -1, 0, 0)
[node name="RP" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 3, 0, 0, 0, 1, 0, -2, 0)
[node name="Relay" type="RemoteTransform3D" parent="RP"]
transform = Transform3D(0.70710678, -0.70710678, 0, 0.70710678, 0.70710678, 0, 0, 0, 1, 3, 1, 0)
remote_path = NodePath("../../P/Target")
${flags}
`;

describe('applyRemoteTransforms (3D) with a partial flag set', () => {
  it('position only keeps the global basis of a target under a scaled parent', () => {
    const { columns, origin } = globalPoseOf(
      shearedScene('update_rotation = false\nupdate_scale = false'),
      'Root/P/Target'
    );
    expectCloseTo(columns[0]!, [1.414214, 0.707107, 0]);
    expectCloseTo(columns[1]!, [-1.414214, 0.707107, 0]);
    expectCloseTo(origin, [3, 1, 0]);
  });

  it('scale only takes the length of each global relay column along the target column', () => {
    const { columns, origin } = globalPoseOf(
      shearedScene('update_position = false\nupdate_rotation = false'),
      'Root/P/Target'
    );
    expectCloseTo(columns[0]!, [2, 1, 0]);
    expectCloseTo(columns[1]!, [-2, 1, 0]);
    expectCloseTo(origin, [-2, 0, 0]);
  });

  it('rotation only takes the direction of each global relay column at the target column length', () => {
    const { columns } = globalPoseOf(
      shearedScene('update_position = false\nupdate_scale = false'),
      'Root/P/Target'
    );
    expectCloseTo(columns[0]!, [0.5, 1.5, 0]);
    expectCloseTo(columns[1]!, [-0.5, 1.5, 0]);
  });

  // A relay with a mirrored x column: the target takes the column as it is, a negative determinant
  // included, where a decomposition would fold the mirror into the scale.
  const mirroredScene = (flags: string): string => `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 4)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(-1, 0, 0, 0, 0.5, 0, 0, 0, 1, -3, 2, 0)
remote_path = NodePath("../Target")
${flags}
`;

  it('rotation only keeps a mirrored relay column and the target column length', () => {
    const { columns, origin } = globalPoseOf(
      mirroredScene('update_position = false\nupdate_scale = false'),
      'Root/Target'
    );
    expectCloseTo(columns[0]!, [-1, 0, 0]);
    expectCloseTo(columns[1]!, [0, 2, 0]);
    expectCloseTo(origin, [0, 0, 4]);
  });

  it('scale only keeps the target column direction at a mirrored relay column length', () => {
    const { columns } = globalPoseOf(
      mirroredScene('update_position = false\nupdate_rotation = false'),
      'Root/Target'
    );
    expectCloseTo(columns[0]!, [1, 0, 0]);
    expectCloseTo(columns[1]!, [0, 0.5, 0]);
  });
});

/** A sub-scene whose relay drives its sibling target, the nodes of unit-remote-transform-3d.tscn. */
const HOLDER = `[gd_scene format=3]
[node name="Holder" type="Node3D"]
[node name="Target" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../Target")
`;

const HOLDER_FILE = 'res://holder.tscn';

/** A host that instances {@link HOLDER_FILE} once for each of `instances`, with `extra` nodes after them. */
function hostOf(instances: readonly string[], extra = ''): string {
  return `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="${HOLDER_FILE}" id="1_holder"]
[node name="Root" type="Node3D"]
${instances.join('\n')}
${extra}
`;
}

const instanceAt = (name: string, transform = ''): string =>
  `[node name="${name}" parent="." instance=ExtResource("1_holder")]\n${transform}`;

describe('applyRemoteTransforms (3D) across an instance border', () => {
  it('seats the target of a relay inside an instance, as the flat scene does', () => {
    const placements = placementsOf(hostOf([instanceAt('Inst')]), { [HOLDER_FILE]: HOLDER });
    expect(targetTransform3D(placements, 'Root/Inst/Target').position.x).toBeCloseTo(2, 5);
  });

  it('moves the target of each instance of one sub-scene by that instance’s own relay', () => {
    // The sub-scene's nodes are shared by both instances, so the result is keyed by the live path.
    const host = hostOf(
      [instanceAt('A'), instanceAt('B')],
      `[node name="Relay" parent="B"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7, 0, 0)`
    );
    const placements = placementsOf(host, { [HOLDER_FILE]: HOLDER });

    expect(targetTransform3D(placements, 'Root/A/Target').position.x).toBeCloseTo(2, 5);
    expect(targetTransform3D(placements, 'Root/B/Target').position.x).toBeCloseTo(7, 5);
  });

  it('reads the merged transform of an instance root, which replaces the sub-scene root’s (ADR-0013)', () => {
    // The sub-scene root sits at +1, the instance at +10: the relay below reads +10 + 2, and the
    // target outside the instance, under the scene root, takes it whole.
    const holder = HOLDER.replace(
      '[node name="Holder" type="Node3D"]',
      '[node name="Holder" type="Node3D"]\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)'
    ).replace('../Target', '../../Outside');
    const host = hostOf(
      [instanceAt('Inst', 'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)')],
      '[node name="Outside" type="Node3D" parent="."]'
    );
    const placements = placementsOf(host, { [HOLDER_FILE]: holder });
    expect(targetTransform3D(placements, 'Root/Outside').position.x).toBeCloseTo(12, 5);
  });

  it('moves a target inside an instance from a relay outside it, in the target’s parent space', () => {
    // The host relay sits at +5. The instance sits at +10, so the target is at -5 in the instance.
    const holder = HOLDER.replace(/\[node name="Relay"[\s\S]*$/, '');
    const host = hostOf(
      [instanceAt('Inst', 'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)')],
      `[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
remote_path = NodePath("../Inst/Target")`
    );
    const placements = placementsOf(host, { [HOLDER_FILE]: holder });
    expect(targetTransform3D(placements, 'Root/Inst/Target').position.x).toBeCloseTo(-5, 5);
  });

  it('relays through a %UniqueName that the instance owns, each instance reading its own table', () => {
    const holder = HOLDER.replace(
      '[node name="Target" type="Node3D" parent="."]',
      '[node name="Target" type="Node3D" parent="."]\nunique_name_in_owner = true'
    ).replace('../Target', '%Target');
    const host = hostOf(
      [instanceAt('A'), instanceAt('B')],
      `[node name="Relay" parent="B"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7, 0, 0)`
    );
    const placements = placementsOf(host, { [HOLDER_FILE]: holder });

    expect(targetTransform3D(placements, 'Root/A/Target').position.x).toBeCloseTo(2, 5);
    expect(targetTransform3D(placements, 'Root/B/Target').position.x).toBeCloseTo(7, 5);
  });

  it('leaves an ancestor alone that a relay inside the instance names across the border', () => {
    const holder = HOLDER.replace('../Target', '../..');
    expect(placementsOf(hostOf([instanceAt('Inst')]), { [HOLDER_FILE]: holder }).size).toBe(0);
  });

  it('leaves the instance root alone that a relay inside the instance names', () => {
    const holder = HOLDER.replace('../Target', '..');
    expect(placementsOf(hostOf([instanceAt('Inst')]), { [HOLDER_FILE]: holder }).size).toBe(0);
  });

  it('binds nothing while the sub-scene has not loaded', () => {
    expect(placementsOf(hostOf([instanceAt('Inst')])).size).toBe(0);
  });
});

describe('applyRemoteTransforms (2D)', () => {
  it('copies the relay global position onto the target (default flags)', () => {
    // Godot 2D: +Y-down. Relay at (120, -40), target authored at (0, 0).
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Sprite2D" parent="."]
position = Vector2(0, 0)
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(120, -40)
remote_path = NodePath("../Target")
`;
    const props = targetNode2D(placementsOf(content), 'Root/Target');
    expect(props.position.x).toBeCloseTo(120, 4);
    expect(props.position.y).toBeCloseTo(-40, 4);
  });

  it('with update_rotation disabled keeps the target rotation but takes the position', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Sprite2D" parent="."]
position = Vector2(0, 0)
rotation = 0.5
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(120, -40)
rotation = 1.2
remote_path = NodePath("../Target")
update_rotation = false
`;
    const props = targetNode2D(placementsOf(content), 'Root/Target');
    expect(props.position.x).toBeCloseTo(120, 4);
    expect(props.rotation).toBeCloseTo(0.5, 4);
  });

  it('zeroes the y scale of a relay whose global axes are parallel, as get_scale() does', () => {
    // The parent's zero y scale lays both of the rotated relay's axes on x: a zero determinant,
    // a non-zero y column. `SIGN(0)` is 0 (typedefs.h:123-126), so the target collapses too.
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Sprite2D" parent="."]
[node name="Flat" type="Node2D" parent="."]
scale = Vector2(1, 0)
[node name="Relay" type="RemoteTransform2D" parent="Flat"]
rotation = 0.5
remote_path = NodePath("../../Target")
`;
    const props = targetNode2D(placementsOf(content), 'Root/Target');
    expect(props.scale.x).toBeCloseTo(Math.cos(0.5), 5);
    expect(props.scale.y).toBe(0);
  });

  it('leaves a target that is no Node2D alone, as the cast to Node2D fails (remote_transform_2d.cpp:54)', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Node3D" parent="."]
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(120, -40)
remote_path = NodePath("../Target")
`;
    expect(placementsOf(content).size).toBe(0);
  });
});

describe('applyRemoteTransforms (2D) refuses a target on its own line of the tree', () => {
  it('leaves the parent of the relay where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Node2D" parent="."]
position = Vector2(100, 0)
[node name="Relay" type="RemoteTransform2D" parent="Target"]
position = Vector2(300, 200)
remote_path = NodePath("..")
`;
    expect(placementsOf(content).size).toBe(0);
  });

  it('leaves the child of the relay where the scene puts it', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
remote_path = NodePath("Child")
[node name="Child" type="Node2D" parent="Relay"]
position = Vector2(10, 20)
`;
    expect(placementsOf(content).size).toBe(0);
  });
});

/**
 * A target under a parent turned 30° and scaled (2, 1), at the global origin (500, 300) before the
 * relay runs, and a relay at (500, 300) turned 45°, scaled (0.5, 1.5) and skewed 0.2. Every
 * expectation is the global matrix Godot 4.6.3 measured (`remote_transform_2d.cpp:63-87`).
 */
const relayScene2D = (flags: string, targetProperties = ''): string => `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="P" type="Node2D" parent="."]
rotation = 0.5235987755982988
scale = Vector2(2, 1)
[node name="Target" type="Node2D" parent="P"]
position = Vector2(291.5063509461097, 9.807621135331601)
rotation = 0.3
scale = Vector2(1, 2)
skew = 0.2
${targetProperties}
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(500, 300)
rotation = 0.78539816339
scale = Vector2(0.5, 1.5)
skew = 0.2
remote_path = NodePath("../P/Target")
${flags}
`;

/** Node2D parts of the parent `P` of a target. */
const TURNED_AND_SCALED_PARENT = {
  rotation: 0.5235987755982988,
  scale: { x: 2, y: 1 },
  position: { x: 0, y: 0 },
};

/** The global matrix of `Root/P/Target` after the relays, as [x, y, origin] columns. */
function globalTarget2D(content: string, parent = TURNED_AND_SCALED_PARENT): number[][] {
  const props = targetNode2D(placementsOf(content), 'Root/P/Target');
  const parentTransform = transform2DFromParts(parent.rotation, parent.scale, 0, parent.position);
  const local = transform2DFromParts(props.rotation, props.scale, props.skew, props.position);
  const g = multiplyTransform2D(parentTransform, local);
  return [
    [g.a, g.b],
    [g.c, g.d],
    [g.tx, g.ty],
  ];
}

function expectMatrix(actual: number[][], expected: number[][]): void {
  expected.forEach((column, i) => expectCloseTo(actual[i]!, column));
}

describe('applyRemoteTransforms (2D) with a partial flag set', () => {
  it('all flags give the relay matrix whole, skew included, under a turned and scaled parent', () => {
    expectMatrix(globalTarget2D(relayScene2D('')), [
      [0.353553, 0.353553],
      [-1.250238, 0.828797],
      [500, 300],
    ]);
  });

  it('rotation only gives the relay direction at the target scale', () => {
    expectMatrix(globalTarget2D(relayScene2D('update_position = false\nupdate_scale = false')), [
      [1.367114, 1.367114],
      [-2.166789, 1.436389],
      [500, 300],
    ]);
  });

  it('scale only gives the relay scale along the target axes', () => {
    expectMatrix(globalTarget2D(relayScene2D('update_position = false\nupdate_rotation = false')), [
      [0.389712, 0.313249],
      [-1.464636, 0.323793],
      [500, 300],
    ]);
  });

  it('position only keeps the target matrix, skew included', () => {
    expectMatrix(globalTarget2D(relayScene2D('update_rotation = false\nupdate_scale = false')), [
      [1.506931, 1.211264],
      [-2.538361, 0.561166],
      [500, 300],
    ]);
  });

  it('writes the skew of the matrix it places', () => {
    const props = targetNode2D(placementsOf(relayScene2D('')), 'Root/P/Target');
    expect(props.skew).toBeCloseTo(-0.24806, 5);
  });

  it('scale only reads the mirror of a relay scaled (1, -0.5) as a negative y scale', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Target" type="Node2D" parent="."]
position = Vector2(50, 50)
rotation = 0.3
scale = Vector2(1, 2)
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
scale = Vector2(1, -0.5)
remote_path = NodePath("../Target")
update_position = false
update_rotation = false
`;
    const props = targetNode2D(placementsOf(content), 'Root/Target');
    const g = transform2DFromParts(props.rotation, props.scale, props.skew, props.position);
    expectCloseTo([g.a, g.b, g.c, g.d, g.tx, g.ty], [0.955337, 0.29552, 0.14776, -0.477668, 50, 50]);
  });
});

/**
 * A relay inside a parent turned 0.4 and scaled (2, 1) at (30, 0), in local coordinates, driving a
 * target under another parent. Godot 4.6.3 pushes the relay's local transform onto the target's
 * local transform when a 2D scene loads, which `remote_transform_2d.cpp:89-107` computes.
 */
const localRelayScene2D = (flags: string): string => `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Off" type="Node2D" parent="."]
position = Vector2(30, 0)
rotation = 0.4
scale = Vector2(2, 1)
[node name="P" type="Node2D" parent="."]
position = Vector2(7, 8)
rotation = -0.6
scale = Vector2(1, 3)
[node name="Target" type="Node2D" parent="P"]
position = Vector2(-10, 4)
rotation = 0.3
scale = Vector2(1, 2)
skew = 0.2
[node name="Relay" type="RemoteTransform2D" parent="Off"]
position = Vector2(200, 50)
rotation = 0.78539816339
scale = Vector2(0.5, 1.5)
skew = 0.2
remote_path = NodePath("../../P/Target")
use_global_coordinates = false
${flags}
`;

const LOCAL_PARENT = { rotation: -0.6, scale: { x: 1, y: 3 }, position: { x: 7, y: 8 } };

describe('applyRemoteTransforms (2D) in local coordinates', () => {
  it('all flags give the relay local transform to the target local transform', () => {
    expectMatrix(globalTarget2D(localRelayScene2D(''), LOCAL_PARENT), [
      [0.890694, 0.675769],
      [0.372056, 2.758045],
      [256.76349, 18.87185],
    ]);
  });

  it('rotation only takes the local relay direction at the local target scale', () => {
    const flags = 'update_position = false\nupdate_scale = false';
    expectMatrix(globalTarget2D(localRelayScene2D(flags), LOCAL_PARENT), [
      [1.781388, 1.351539],
      [0.496074, 3.677393],
      [5.522354, 23.55045],
    ]);
  });

  it('scale only takes the local relay scale along the local target axes', () => {
    const flags = 'update_position = false\nupdate_rotation = false';
    expectMatrix(globalTarget2D(localRelayScene2D(flags), LOCAL_PARENT), [
      [0.644531, 0.096143],
      [1.636312, 3.665407],
      [5.522354, 23.55045],
    ]);
  });

  it('position only takes the local relay origin', () => {
    const flags = 'update_rotation = false\nupdate_scale = false';
    expectMatrix(globalTarget2D(localRelayScene2D(flags), LOCAL_PARENT), [
      [1.289063, 0.192287],
      [2.181748, 4.887209],
      [256.76349, 18.87185],
    ]);
  });

  it('no flag leaves the target where the scene puts it', () => {
    const flags = 'update_position = false\nupdate_rotation = false\nupdate_scale = false';
    expect(placementsOf(localRelayScene2D(flags)).size).toBe(0);
  });
});

describe('applyRemoteTransforms (2D) under a transformed parent', () => {
  it('re-expresses the relay pose in the rotated, scaled parent space and drops the target skew', () => {
    // Parent maps local (x, y) to (100 - 2y, 2x), so the relay's global (100, 50) is the
    // local (25, 0), its rotation 0 is -PI/2 and its scale 1 is 0.5 there. The relay's matrix has
    // no skew in a conformal parent, so the target's own skew of 0.3 goes.
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Parent" type="Node2D" parent="."]
position = Vector2(100, 0)
rotation = 1.5707963267948966
scale = Vector2(2, 2)
[node name="Target" type="Sprite2D" parent="Parent"]
position = Vector2(7, 7)
skew = 0.3
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(100, 50)
remote_path = NodePath("../Parent/Target")
`;
    const props = targetNode2D(placementsOf(content), 'Root/Parent/Target');
    expect(props.position.x).toBeCloseTo(25, 5);
    expect(props.position.y).toBeCloseTo(0, 5);
    expect(props.rotation).toBeCloseTo(-Math.PI / 2, 5);
    expect(props.scale.x).toBeCloseTo(0.5, 5);
    expect(props.scale.y).toBeCloseTo(0.5, 5);
    expect(props.skew).toBeCloseTo(0, 5);
  });
});

const HOLDER_2D = `[gd_scene format=3]
[node name="Holder" type="Node2D"]
[node name="Target" type="Polygon2D" parent="."]
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
remote_path = NodePath("../Target")
`;

const host2D = (instance: string, extra = '') => `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="${HOLDER_FILE}" id="1_holder"]
[node name="Root" type="Node2D"]
${instance}
${extra}
`;

describe('applyRemoteTransforms (2D) across an instance border', () => {
  it('seats the target of a relay inside an instance, as the flat scene does', () => {
    // The instance is at (100, 50) and the relay at (300, 200) below it: the target takes the relay's pose.
    const host = host2D(
      '[node name="Inst" parent="." instance=ExtResource("1_holder")]\nposition = Vector2(100, 50)'
    );
    const props = targetNode2D(placementsOf(host, { [HOLDER_FILE]: HOLDER_2D }), 'Root/Inst/Target');
    expect(props.position.x).toBeCloseTo(300, 5);
    expect(props.position.y).toBeCloseTo(200, 5);
  });

  it('moves a target inside an instance from a relay outside it, in the target’s parent space', () => {
    const holder = HOLDER_2D.replace(/\[node name="Relay"[\s\S]*$/, '');
    const host = host2D(
      '[node name="Inst" parent="." instance=ExtResource("1_holder")]\nposition = Vector2(100, 50)',
      `[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
remote_path = NodePath("../Inst/Target")`
    );
    const props = targetNode2D(placementsOf(host, { [HOLDER_FILE]: holder }), 'Root/Inst/Target');
    expect(props.position.x).toBeCloseTo(200, 5);
    expect(props.position.y).toBeCloseTo(150, 5);
  });

  it('moves a target outside an instance from a relay inside it', () => {
    const holder = HOLDER_2D.replace('../Target', '../../Outside');
    const host = host2D(
      '[node name="Inst" parent="." instance=ExtResource("1_holder")]\nposition = Vector2(100, 50)',
      '[node name="Outside" type="Polygon2D" parent="."]'
    );
    const props = targetNode2D(placementsOf(host, { [HOLDER_FILE]: holder }), 'Root/Outside');
    expect(props.position.x).toBeCloseTo(400, 5);
    expect(props.position.y).toBeCloseTo(250, 5);
  });
});
