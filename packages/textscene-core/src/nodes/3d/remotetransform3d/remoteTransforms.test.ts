/**
 * The RemoteTransform scene pass over the Live scene tree. Godot resolves `remote_path` with
 * `get_node` on the live tree (`remote_transform_3d.cpp:35-36`, `remote_transform_2d.cpp:35-36`), so
 * a relay and its target meet across an instance border as they do in one file. The numbers match
 * real Godot 4.6.3 in the ref harness (fixtures unit-remote-transform-3d/2d.tscn).
 */

import { describe, it, expect } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import type { NodePatches } from '../../../r3f/nodePatch';
import { decomposeTransform3D } from '../../../utils/transform';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import type { Node2DProperties } from '../../../nodes/base/node2d/types';
import { applyRemoteTransforms } from './remoteTransforms';

/** What the pass binds in `content`'s live tree, with each scene of `scenes` loaded. */
function placementsOf(content: string, scenes: Readonly<Record<string, string>> = {}): NodePatches {
  const parse = (text: string) => new TscnParser().parse(text);
  const main = parse(content);
  const loaded = Object.fromEntries(Object.entries(scenes).map(([path, text]) => [path, parse(text)]));
  return applyRemoteTransforms(liveTreeOf(main.nodes, contextOver(main, loaded)));
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
    expect(props.scale.x).toBeCloseTo(Math.cos(0.5), 12);
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

describe('applyRemoteTransforms (2D) under a transformed parent', () => {
  it('re-expresses the relay pose in the rotated, scaled parent space and does not touch the skew', () => {
    // Parent maps local (x, y) to (100 - 2y, 2x), so the relay's global (100, 50) is the
    // local (25, 0), its rotation 0 is -PI/2 and its scale 1 is 0.5 there. RemoteTransform2D
    // pushes position, rotation and scale only, so the target's own skew stays out of the patch.
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
    expect(props.position.x).toBeCloseTo(25, 9);
    expect(props.position.y).toBeCloseTo(0, 9);
    expect(props.rotation).toBeCloseTo(-Math.PI / 2, 9);
    expect(props.scale.x).toBeCloseTo(0.5, 9);
    expect(props.scale.y).toBeCloseTo(0.5, 9);
    expect(props.skew).toBeUndefined();
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
    expect(props.position.x).toBeCloseTo(300, 9);
    expect(props.position.y).toBeCloseTo(200, 9);
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
    expect(props.position.x).toBeCloseTo(200, 9);
    expect(props.position.y).toBeCloseTo(150, 9);
  });

  it('moves a target outside an instance from a relay inside it', () => {
    const holder = HOLDER_2D.replace('../Target', '../../Outside');
    const host = host2D(
      '[node name="Inst" parent="." instance=ExtResource("1_holder")]\nposition = Vector2(100, 50)',
      '[node name="Outside" type="Polygon2D" parent="."]'
    );
    const props = targetNode2D(placementsOf(host, { [HOLDER_FILE]: holder }), 'Root/Outside');
    expect(props.position.x).toBeCloseTo(400, 9);
    expect(props.position.y).toBeCloseTo(250, 9);
  });
});
