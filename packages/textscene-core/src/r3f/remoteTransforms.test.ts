/**
 * RemoteTransform resolution, asserted through the PUBLIC build
 * (`parseTscnContent` → SceneGraph → flattened target transform), not the
 * pass's internals. Numbers are cross-checked against real Godot 4.6.3 via the
 * ref harness (see the fixtures unit-remote-transform-3d/2d.tscn).
 */

import { describe, it, expect } from 'vitest';
import { parseTscnContent } from './hooks/useParsedScene';
import { TscnParser } from '../parser/TscnParser';
import { uniqueNamePaths } from '../utils/uniqueNames';
import { decomposeTransform3D, identityTransform3D } from '../utils/transform';
import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { Node2DProperties } from '../nodes/base/node2d/types';

function targetTransform3D(content: string, path: string) {
  const { sceneGraph } = parseTscnContent(content, 'res://test.tscn');
  const node = sceneGraph?.flattenedNodes.find((n) => n.path === path);
  if (!node) throw new Error(`node not found: ${path}`);
  const transform = (node.data.properties as Node3DProperties).transform ?? identityTransform3D();
  return decomposeTransform3D(transform);
}

function targetNode2D(content: string, path: string): Node2DProperties {
  const { sceneGraph } = parseTscnContent(content, 'res://test.tscn');
  const node = sceneGraph?.flattenedNodes.find((n) => n.path === path);
  if (!node) throw new Error(`node not found: ${path}`);
  return node.data.properties as Node2DProperties;
}

describe('applyRemoteTransforms (3D)', () => {
  it('relays through a %UniqueName target', () => {
    // Same geometry as the sibling case below, addressed by unique name instead.
    // Godot resolves `%TargetCube` through the owner's claim table, so the target
    // still lands at +2.
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
    const { position } = targetTransform3D(content, 'Root/TargetCube');
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
    const { position } = targetTransform3D(content, 'Root/TargetCube');
    expect(position.x).toBeCloseTo(-2, 5);
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
    const { position } = targetTransform3D(content, 'Root/TargetCube');
    expect(position.x).toBeCloseTo(2, 5);
    expect(position.y).toBeCloseTo(0, 5);
    expect(position.z).toBeCloseTo(0, 5);
  });

  it('with update_rotation/scale disabled, pushes only position and keeps the target rotation & scale', () => {
    // Relay at (5,0,0) with a Y rotation & scale that must NOT reach the target.
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
    const { position, rotation, scale } = targetTransform3D(content, 'Root/Target');
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
    // Parent translated +3 X; relay local +2 X ⇒ relay global +5 X.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Offset" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
[node name="Relay" type="RemoteTransform3D" parent="Offset"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../../Target")
[node name="Target" type="Node3D" parent="."]
`;
    const { position } = targetTransform3D(content, 'Root/Target');
    expect(position.x).toBeCloseTo(5, 5);
  });

  it('with use_global_coordinates = false, leaves the target untouched (static-render no-op)', () => {
    // Measured against Godot 4.6.3 (matched pair, flag-only difference): the
    // local-coordinate relay does NOT reposition its target on a static load —
    // only the default global mode does. The target keeps its authored transform
    // (identity here), so it stays at the origin, not the relay's +2.
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
    const { position } = targetTransform3D(content, 'Root/Target');
    expect(position.x).toBeCloseTo(0, 5);
  });

  it('resolves a relay chain in document order (A drives B, B drives C)', () => {
    // Relay A at +4 drives B; B (itself a relay at authored +1) is driven to +4,
    // then B drives C ⇒ C ends at +4.
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
    expect(targetTransform3D(content, 'Root/B').position.x).toBeCloseTo(4, 5);
    expect(targetTransform3D(content, 'Root/C').position.x).toBeCloseTo(4, 5);
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
    const { sceneGraph, error } = parseTscnContent(content, 'res://test.tscn');
    expect(error).toBeNull();
    expect(sceneGraph).not.toBeNull();
    // The unrelated target keeps its authored -2.
    expect(targetTransform3D(content, 'Root/Target').position.x).toBeCloseTo(-2, 5);
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
    const props = targetNode2D(content, 'Root/Target');
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
    const props = targetNode2D(content, 'Root/Target');
    expect(props.position.x).toBeCloseTo(120, 4);
    expect(props.rotation).toBeCloseTo(0.5, 4);
  });
});

describe('the %Name table this module builds inline', () => {
  it('answers what the shared claim walk answers', () => {
    // The inline collection is fused into a walk `applyRemoteTransforms` needs
    // anyway, so it is a second APPLICATION of one rule rather than a second
    // copy of it. This is what holds the two together: Godot's claim is
    // owner-scoped and first-one-wins (node.cpp:2222-2231), and a change to
    // either half has to move both.
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Rig" type="Node3D" parent="."]
unique_name_in_owner = true
[node name="Target" type="Node3D" parent="Rig"]
unique_name_in_owner = true
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
[node name="Target" type="Node3D" parent="."]
unique_name_in_owner = true
[node name="Relay" type="RemoteTransform3D" parent="."]
remote_path = NodePath("%Target")
`;
    const nodes = new TscnParser().parse(content).nodes;
    const shared = uniqueNamePaths(nodes);
    // The deeper claim wins on document order, and the later sibling does not
    // take the key from it — the property both halves have to agree on.
    expect(shared.get('%Target')).toBe('Root/Rig/Target');
    expect(shared.get('%Rig')).toBe('Root/Rig');

    // And the relay resolves through the same answer: the target it moves is
    // the one the shared walk names, not the shallower namesake.
    expect(targetTransform3D(content, 'Root/Rig/Target').position.x).toBe(0);
  });
});
