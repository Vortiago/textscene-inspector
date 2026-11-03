/**
 * The order in which the RemoteTransform pass pushes its relays. Godot pushes a relay each time its
 * own global transform changes, in the order of the tree's transform-change list
 * (`scene_tree.cpp:193-204`), so a relay chain and a relay cycle take the pose Godot draws. Every
 * expected pose is measured on Godot 4.6.3 at the frames the `ref:godot` harness runs.
 */

import { describe, it, expect } from 'vitest';
import { contextOver, liveTreeOfText } from '../../../r3f/liveSceneTree.testkit';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { TscnParser } from '../../../parser/TscnParser';
import { liveGlobalTransform3D, nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform';
import { node2DLocalTransform } from '../../../r3f/node2dTransform';
import { TRANSFORM2D_IDENTITY, multiplyTransform2D } from '../../../godot/math/transform2d';
import { applyRemoteTransforms } from './remoteTransforms';

/** The global origin of the Node3D at `path` after the relays have run. */
function globalOrigin3D(content: string, path: string): number[] {
  const tree = liveTreeOfText(content);
  const global = liveGlobalTransform3D(tree, path, applyRemoteTransforms(tree));
  if (!global) throw new Error(`expected a Node3D at ${path}`);
  return [global.origin.x, global.origin.y, global.origin.z];
}

/** The global origin of the Node2D at `path` after the relays have run. */
function globalOrigin2D(content: string, path: string): number[] {
  const tree = liveTreeOfText(content);
  let global = TRANSFORM2D_IDENTITY;
  for (const node of nodesOnTheWayTo(tree, path, applyRemoteTransforms(tree)).values()) {
    global = multiplyTransform2D(global, node2DLocalTransform(node.properties));
  }
  return [global.tx, global.ty];
}

function expectCloseTo(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 4));
}

/** An early relay under a holder that a later relay in the file drives. */
const CHAIN_3D = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="D_Holder" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 8)
[node name="EarlyRelay" type="RemoteTransform3D" parent="D_Holder"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../D_Target")
[node name="D_Target" type="Node3D" parent="."]
[node name="LateRelay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 8)
remote_path = NodePath("../D_Holder")
`;

const CHAIN_2D = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="D_Holder" type="Node2D" parent="."]
position = Vector2(0, 80)
[node name="EarlyRelay" type="RemoteTransform2D" parent="D_Holder"]
position = Vector2(10, 0)
remote_path = NodePath("../../D_Target")
[node name="D_Target" type="Node2D" parent="."]
[node name="LateRelay" type="RemoteTransform2D" parent="."]
position = Vector2(100, 80)
remote_path = NodePath("../D_Holder")
`;

/** Relay R drives T, and relay Q drives T's parent P, in the order the file lists them. */
function targetParent3D(order: 'RQ' | 'QR'): string {
  const relays = {
    R: `[node name="R" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
remote_path = NodePath("../P/T")`,
    Q: `[node name="Q" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)
remote_path = NodePath("../P")`,
  };
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="P" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 5)
[node name="T" type="Node3D" parent="P"]
${relays[order[0] as 'R' | 'Q']}
${relays[order[1] as 'R' | 'Q']}
`;
}

function targetParent2D(order: 'RQ' | 'QR'): string {
  const relays = {
    R: `[node name="R" type="RemoteTransform2D" parent="."]
position = Vector2(20, 0)
remote_path = NodePath("../P/T")`,
    Q: `[node name="Q" type="RemoteTransform2D" parent="."]
position = Vector2(100, 0)
remote_path = NodePath("../P")`,
  };
  return `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="P" type="Node2D" parent="."]
position = Vector2(0, 50)
[node name="T" type="Node2D" parent="P"]
${relays[order[0] as 'R' | 'Q']}
${relays[order[1] as 'R' | 'Q']}
`;
}

describe('applyRemoteTransforms pushes a relay again when its own global transform changes', () => {
  it('moves the target of an early relay whose holder a later relay drives (3D)', () => {
    expectCloseTo(globalOrigin3D(CHAIN_3D, 'Root/D_Target'), [11, 0, 8]);
  });

  it('moves the target of an early relay whose holder a later relay drives (2D)', () => {
    expectCloseTo(globalOrigin2D(CHAIN_2D, 'Root/D_Target'), [110, 80]);
  });

  it('leaves the target where its relay put it when the relay of its parent comes later in the file (3D)', () => {
    expectCloseTo(globalOrigin3D(targetParent3D('RQ'), 'Root/P/T'), [2, 0, 0]);
  });

  it('carries the target with its parent when the relay of the parent comes first in the file (3D)', () => {
    expectCloseTo(globalOrigin3D(targetParent3D('QR'), 'Root/P/T'), [12, 0, -5]);
  });

  it('leaves the target where its relay put it when the relay of its parent comes later in the file (2D)', () => {
    expectCloseTo(globalOrigin2D(targetParent2D('RQ'), 'Root/P/T'), [20, 0]);
  });

  it('carries the target with its parent when the relay of the parent comes first in the file (2D)', () => {
    expectCloseTo(globalOrigin2D(targetParent2D('QR'), 'Root/P/T'), [120, -50]);
  });
});

/** Holder A carries relay A, which drives holder B. Holder B carries relay B, which drives holder A. */
function cycle3D(relayATransform = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)'): string {
  return `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="HolderA" type="Node3D" parent="."]
[node name="Box" type="MeshInstance3D" parent="HolderA"]
[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
transform = ${relayATransform}
remote_path = NodePath("../../HolderB")
[node name="HolderB" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
[node name="RelayB" type="RemoteTransform3D" parent="HolderB"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../HolderA")
`;
}

const CYCLE_2D = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="HolderA" type="Node2D" parent="."]
[node name="RelayA" type="RemoteTransform2D" parent="HolderA"]
position = Vector2(10, 0)
remote_path = NodePath("../../HolderB")
[node name="HolderB" type="Node2D" parent="."]
position = Vector2(0, 100)
[node name="RelayB" type="RemoteTransform2D" parent="HolderB"]
position = Vector2(10, 0)
remote_path = NodePath("../../HolderA")
`;

describe('applyRemoteTransforms draws a relay cycle at the frame the ref:godot harness captures', () => {
  it('puts the holders of a 3D cycle where Godot has pushed them by then', () => {
    expectCloseTo(globalOrigin3D(cycle3D(), 'Root/HolderA'), [2883, 0, 3]);
    expectCloseTo(globalOrigin3D(cycle3D(), 'Root/HolderB'), [2882, 0, 3]);
  });

  it("counts the project's physics ticks, which flush transforms too", () => {
    // Godot logged holder A at x 2993 with `physics_ticks_per_second=120`.
    const main = new TscnParser().parse(cycle3D());
    const tree = liveTreeOf(main.nodes, {
      ...contextOver(main, {}),
      physicsClock: { ticksPerSecond: 120, jitterFix: 0.5 },
    });
    const holderA = liveGlobalTransform3D(tree, 'Root/HolderA', applyRemoteTransforms(tree))!;
    expectCloseTo([holderA.origin.x, holderA.origin.y, holderA.origin.z], [2993, 0, 3]);
  });

  it('draws a mesh where its last transform notification left it, a push behind its holder', () => {
    // Godot hands a VisualInstance3D's global transform to the server only when a flush notifies
    // it (`visual_instance_3d.cpp:90-96`). Holder A moves in the last flush, so its box is queued
    // for a flush the harness frame does not run.
    expectCloseTo(globalOrigin3D(cycle3D(), 'Root/HolderA/Box'), [2881, 0, 3]);
  });

  it('draws the mesh of a turned cycle a whole turn step behind its holder', () => {
    const turned = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="HolderA" type="Node3D" parent="."]
[node name="Box" type="MeshInstance3D" parent="HolderA"]
[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
transform = Transform3D(0.9848078, 0, -0.1736482, 0, 1, 0, 0.1736482, 0, 0.9848078, 0.5, 0, 0)
remote_path = NodePath("../../HolderB")
[node name="HolderB" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1)
[node name="RelayB" type="RemoteTransform3D" parent="HolderB"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 0, 0)
remote_path = NodePath("../../HolderA")
`;
    const box = globalOrigin3D(turned, 'Root/HolderA/Box');
    [0.500087, 0, 0.999679].forEach((value, i) => expect(Math.abs(box[i]! - value)).toBeLessThan(1e-3));
  });

  it('puts the holders of a 2D cycle where Godot has pushed them by then', () => {
    expectCloseTo(globalOrigin2D(CYCLE_2D, 'Root/HolderA'), [28830, 100]);
    expectCloseTo(globalOrigin2D(CYCLE_2D, 'Root/HolderB'), [28820, 100]);
  });

  it('turns the holders of a cycle whose relay is turned 10° about Y as Godot does', () => {
    const turned = 'Transform3D(0.984807753, 0, -0.173648178, 0, 1, 0, 0.173648178, 0, 0.984807753, 1, 0, 0)';
    const tree = liveTreeOfText(cycle3D(turned));
    const placed = applyRemoteTransforms(tree);
    const holderA = liveGlobalTransform3D(tree, 'Root/HolderA', placed)!;
    const holderB = liveGlobalTransform3D(tree, 'Root/HolderB', placed)!;
    // Godot keeps 32-bit floats, so 1e-3, not the default precision.
    const expectNear = (actual: number[], expected: number[]) =>
      expected.forEach((value, i) => expect(Math.abs(actual[i]! - value)).toBeLessThan(1e-3));
    const { origin: a, basis_x: rowX, basis_y: rowY, basis_z: rowZ } = holderA;
    expectNear([a.x, a.y, a.z], [2.984758, 0, 3.173826]);
    expectNear([rowX.x, rowY.x, rowZ.x], [0.984798, 0, 0.173649]);
    expectNear([holderB.origin.x, holderB.origin.y, holderB.origin.z], [1.999961, 0, 3.000177]);
  });

  it('draws a holder nowhere once a scaled cycle grows it past the 32-bit range', () => {
    const scaled = 'Transform3D(1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 1, 0, 0)';
    const origin = globalOrigin3D(cycle3D(scaled), 'Root/HolderA');
    expect(origin.every(Number.isNaN)).toBe(true);
  });

  it('draws a 2D holder nowhere once a scaled cycle grows it past the 32-bit range', () => {
    const scaled = CYCLE_2D.replace(
      'position = Vector2(10, 0)',
      'position = Vector2(10, 0)\nscale = Vector2(1.1, 1.1)'
    );
    expect(globalOrigin2D(scaled, 'Root/HolderA').every(Number.isNaN)).toBe(true);
  });
});

describe('applyRemoteTransforms pushes a relay in local coordinates the moment another relay moves it', () => {
  it('moves the holder of a 3D cycle that runs through a local relay on every flush', () => {
    // Godot logged the holder at x 2882 by the harness frame.
    const mixed = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Holder" type="Node3D" parent="."]
[node name="Global" type="RemoteTransform3D" parent="Holder"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../Local")
[node name="Local" type="RemoteTransform3D" parent="."]
remote_path = NodePath("../Holder")
use_global_coordinates = false
`;
    expectCloseTo(globalOrigin3D(mixed, 'Root/Holder'), [2882, 0, 0]);
  });

  it('moves the holder of a 2D cycle that runs through a local relay on every flush', () => {
    const mixed = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Holder" type="Node2D" parent="."]
[node name="Global" type="RemoteTransform2D" parent="Holder"]
position = Vector2(10, 0)
remote_path = NodePath("../../Local")
[node name="Local" type="RemoteTransform2D" parent="."]
remote_path = NodePath("../Holder")
use_global_coordinates = false
`;
    expectCloseTo(globalOrigin2D(mixed, 'Root/Holder'), [28820, 0]);
  });

  it('gives the target the new local transform of a 3D local relay', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node3D"]
[node name="Driver" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
remote_path = NodePath("../LocalRelay")
[node name="LocalRelay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../Holder/T")
use_global_coordinates = false
[node name="Holder" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 7)
[node name="T" type="Node3D" parent="Holder"]
`;
    expectCloseTo(globalOrigin3D(content, 'Root/Holder/T'), [5, 0, 7]);
  });

  it('gives the target the new local transform of a 2D local relay', () => {
    const content = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Driver" type="RemoteTransform2D" parent="."]
position = Vector2(50, 0)
remote_path = NodePath("../LocalRelay")
[node name="LocalRelay" type="RemoteTransform2D" parent="."]
position = Vector2(10, 0)
remote_path = NodePath("../Holder/T")
use_global_coordinates = false
[node name="Holder" type="Node2D" parent="."]
position = Vector2(0, 70)
[node name="T" type="Node2D" parent="Holder"]
`;
    expectCloseTo(globalOrigin2D(content, 'Root/Holder/T'), [50, 70]);
  });
});
