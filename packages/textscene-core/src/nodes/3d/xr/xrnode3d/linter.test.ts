/**
 * Tests for the XRNode3D family rule (`valid-xrnode3d`): the missing-XROrigin3D
 * parent warning and the explicitly-emptied-pose warning, and that both reach
 * XRAnchor3D and XRController3D through `applicableNodeTypeMatcher` —
 * `RuleRegistry`'s exact-match default would otherwise leave both subclasses
 * unchecked, since neither overrides `get_configuration_warnings` itself.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import '../../../base/node3d/linterParser';
import './linterParser';
import '../xranchor3d/linterParser';
import '../xrcontroller3d/linterParser';
import './linter';

const PARENT_RULE = 'xrnode3d-parent-not-xrorigin3d';
const NO_POSE_RULE = 'xrnode3d-no-pose-set';
const FAMILY: readonly string[] = ['XRNode3D', 'XRAnchor3D', 'XRController3D'];

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>, ruleName: string) {
  return diagnostics.filter((d) => d.ruleName === ruleName);
}

describe('XRNode3D family rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('parent check', () => {
    for (const type of FAMILY) {
      it(`warns for a ${type} under any other typed parent`, () => {
        const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Tracked" type="${type}" parent="."]
`;
        const found = ruleDiagnostics(linter.lint(content), PARENT_RULE);
        expect(found).toHaveLength(1);
        expect(found[0]!.severity).toBe('warning');
        expect(found[0]!.message).toContain('Node3D');
        // Godot's message text always names the base class, even for a subclass.
        expect(found[0]!.message).toContain('XRNode3D');
      });

      it(`accepts a ${type} parented to an XROrigin3D`, () => {
        const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="${type}" parent="."]
`;
        expect(ruleDiagnostics(linter.lint(content), PARENT_RULE)).toEqual([]);
      });
    }

    it('stays quiet when the node has no parent at all', () => {
      const content = `[gd_scene format=3]

[node name="Tracked" type="XRNode3D"]
`;
      expect(ruleDiagnostics(linter.lint(content), PARENT_RULE)).toEqual([]);
    });

    it('stays quiet when the node is explicitly hidden', () => {
      // Node3D::is_visible() (node_3d.cpp:1127-1130) reads only the node's own
      // flag, so Godot's own check never fires here either.
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Tracked" type="XRNode3D" parent="."]
visible = false
`;
      expect(ruleDiagnostics(linter.lint(content), PARENT_RULE)).toEqual([]);
    });

    it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Tracked" type="XRNode3D" parent="Rig"]
`;
      expect(ruleDiagnostics(linter.lint(content), PARENT_RULE)).toEqual([]);
    });
  });

  describe('empty-pose check', () => {
    it('warns when pose is explicitly cleared to &""', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="XRNode3D" parent="."]
pose = &""
`;
      const found = ruleDiagnostics(linter.lint(content), NO_POSE_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it('warns when pose is explicitly cleared to ""', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="XRNode3D" parent="."]
pose = ""
`;
      expect(ruleDiagnostics(linter.lint(content), NO_POSE_RULE)).toHaveLength(1);
    });

    it('stays quiet when pose is unset — the default is &"default", not empty', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="XRNode3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), NO_POSE_RULE)).toEqual([]);
    });

    it('stays quiet when pose names a real pose', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="XRNode3D" parent="."]
pose = &"grip"
`;
      expect(ruleDiagnostics(linter.lint(content), NO_POSE_RULE)).toEqual([]);
    });

    it('stays quiet when the node is explicitly hidden', () => {
      // xr_nodes.cpp:498 gates the whole override body, this warning included.
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="XRNode3D" parent="."]
visible = false
pose = &""
`;
      expect(ruleDiagnostics(linter.lint(content), NO_POSE_RULE)).toEqual([]);
    });

    it('reaches XRAnchor3D and XRController3D too', () => {
      for (const type of ['XRAnchor3D', 'XRController3D']) {
        const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Tracked" type="${type}" parent="."]
pose = &""
`;
        expect(ruleDiagnostics(linter.lint(content), NO_POSE_RULE)).toHaveLength(1);
      }
    });
  });

  it('leaves its own fixture clean of both rules', () => {
    const content = readFixture('unit-xr-node-3d.tscn');
    const diagnostics = linter.lint(content);
    expect(ruleDiagnostics(diagnostics, PARENT_RULE)).toEqual([]);
    expect(ruleDiagnostics(diagnostics, NO_POSE_RULE)).toEqual([]);
  });
});
