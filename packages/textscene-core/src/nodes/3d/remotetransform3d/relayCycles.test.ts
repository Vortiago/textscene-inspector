/**
 * The relay cycle rules of RemoteTransform3D and RemoteTransform2D. Godot pushes a relay each time
 * its own global transform changes (`remote_transform_3d.cpp:118-126`,
 * `remote_transform_2d.cpp:127-136`), so a relay cycle moves on every frame without end.
 */

import { describe, it, expect } from 'vitest';
import { lintRule } from '../../../linter/testing/testkit';
import './linter';
import '../../2d/remotetransform2d/linter';

const RULE_3D = 'remotetransform3d-relay-cycle';
const RULE_2D = 'remotetransform2d-relay-cycle';

/** The names of the nodes `ruleName` warns on in `content`. */
function warnedNodes(content: string, ruleName: string): string[] {
  const diagnostics = lintRule(content, ruleName);
  diagnostics.forEach((diagnostic) => expect(diagnostic).toBeAtTier('warning'));
  return diagnostics.map((diagnostic) => diagnostic.nodeName).sort();
}

/** Holder A carries relay A, which drives holder B. Holder B carries relay B, which drives holder A. */
function cycle3D(relayAProperties = ''): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="HolderA" type="Node3D" parent="."]

[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
remote_path = NodePath("../../HolderB")
${relayAProperties}

[node name="HolderB" type="Node3D" parent="."]

[node name="Inner" type="Node3D" parent="HolderB"]

[node name="RelayB" type="RemoteTransform3D" parent="HolderB/Inner"]
remote_path = NodePath("../../../HolderA")
`;
}

function cycle2D(relayAProperties = ''): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="HolderA" type="Node2D" parent="."]

[node name="RelayA" type="RemoteTransform2D" parent="HolderA"]
remote_path = NodePath("../../HolderB")
${relayAProperties}

[node name="HolderB" type="Node2D" parent="."]

[node name="RelayB" type="RemoteTransform2D" parent="HolderB"]
remote_path = NodePath("../../HolderA")
`;
}

const CHAIN_3D = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="D_Holder" type="Node3D" parent="."]

[node name="EarlyRelay" type="RemoteTransform3D" parent="D_Holder"]
remote_path = NodePath("../../D_Target")

[node name="D_Target" type="Node3D" parent="."]

[node name="LateRelay" type="RemoteTransform3D" parent="."]
remote_path = NodePath("../D_Holder")
`;

const TARGET_PARENT_3D = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="P" type="Node3D" parent="."]

[node name="T" type="Node3D" parent="P"]

[node name="R" type="RemoteTransform3D" parent="."]
remote_path = NodePath("../P/T")

[node name="Q" type="RemoteTransform3D" parent="."]
remote_path = NodePath("../P")
`;

describe('the RemoteTransform3D relay cycle rule', () => {
  it('warns on each relay of a cycle, through a node below the target', () => {
    expect(warnedNodes(cycle3D(), RULE_3D)).toEqual(['RelayA', 'RelayB']);
  });

  it('stays silent on a chain, which settles', () => {
    expect(warnedNodes(CHAIN_3D, RULE_3D)).toEqual([]);
  });

  it('stays silent on relays that drive a target and its parent', () => {
    expect(warnedNodes(TARGET_PARENT_3D, RULE_3D)).toEqual([]);
  });

  it('stays silent when a relay of the cycle works in local coordinates, which a move of its holder does not push', () => {
    expect(warnedNodes(cycle3D('use_global_coordinates = false'), RULE_3D)).toEqual([]);
  });

  it('stays silent when a top_level node cuts the cycle, as a move does not reach below it', () => {
    const cut = cycle3D().replace(
      '[node name="Inner" type="Node3D" parent="HolderB"]',
      '[node name="Inner" type="Node3D" parent="HolderB"]\ntop_level = true'
    );
    expect(warnedNodes(cut, RULE_3D)).toEqual([]);
  });

  it('stays silent on a cycle through an instanced scene, which one file cannot see whole', () => {
    const throughInstance = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://holder.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="HolderA" type="Node3D" parent="."]

[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
remote_path = NodePath("../../HolderB")

[node name="HolderB" parent="." instance=ExtResource("1")]

[node name="RelayB" type="RemoteTransform3D" parent="HolderB"]
remote_path = NodePath("../../HolderA")
`;
    expect(warnedNodes(throughInstance, RULE_3D)).toEqual([]);
  });
});

/** A global relay drives a local relay, whose push moves the global relay's holder. */
const MIXED_3D = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Holder" type="Node3D" parent="."]

[node name="Global" type="RemoteTransform3D" parent="Holder"]
remote_path = NodePath("../../Local")

[node name="Local" type="RemoteTransform3D" parent="."]
remote_path = NodePath("../Holder")
use_global_coordinates = false
`;

describe('the RemoteTransform3D relay cycle rule, with relays in local coordinates', () => {
  it('warns on a cycle through a local relay that another relay moves, which pushes at once', () => {
    expect(warnedNodes(MIXED_3D, RULE_3D)).toEqual(['Global', 'Local']);
  });

  it('stays silent on a cycle of local relays alone, which no push starts when the scene loads', () => {
    const localOnly = MIXED_3D.replace(
      'remote_path = NodePath("../../Local")',
      'remote_path = NodePath("../../Local")\nuse_global_coordinates = false'
    );
    expect(warnedNodes(localOnly, RULE_3D)).toEqual([]);
  });

  it('reads a flag as the previewer does, so a malformed one moves nothing', () => {
    const malformed = cycle3D('update_position = yes\nupdate_rotation = no\nupdate_scale = 0');
    expect(warnedNodes(malformed, RULE_3D)).toEqual([]);
  });
});

describe('the RemoteTransform2D relay cycle rule', () => {
  it('warns on each relay of a cycle', () => {
    expect(warnedNodes(cycle2D(), RULE_2D)).toEqual(['RelayA', 'RelayB']);
  });

  it('stays silent when a relay of the cycle flags no part, as it pushes nothing', () => {
    const noPart = 'update_position = false\nupdate_rotation = false\nupdate_scale = false';
    expect(warnedNodes(cycle2D(noPart), RULE_2D)).toEqual([]);
  });

  it('stays silent on a chain, which settles', () => {
    const chain2D = CHAIN_3D.replaceAll('Node3D', 'Node2D').replaceAll(
      'RemoteTransform3D',
      'RemoteTransform2D'
    );
    expect(warnedNodes(chain2D, RULE_2D)).toEqual([]);
  });
});
