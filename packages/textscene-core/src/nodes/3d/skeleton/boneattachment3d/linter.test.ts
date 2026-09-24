/**
 * The BoneAttachment3D skeleton-resolution rule (`boneattachment3d-parent-not-skeleton3d` and
 * `boneattachment3d-external-skeleton-unset`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const PARENT_RULE = 'boneattachment3d-parent-not-skeleton3d';
const EXTERNAL_RULE = 'boneattachment3d-external-skeleton-unset';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === PARENT_RULE || d.ruleName === EXTERNAL_RULE);
}

describe('BoneAttachment3D skeleton-resolution rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts an attachment parented to a Skeleton3D', () => {
    const content = `[gd_scene format=3]

[node name="Skeleton3D" type="Skeleton3D"]

[node name="Attachment" type="BoneAttachment3D" parent="."]
bone_idx = 0
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for an attachment under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Attachment" type="BoneAttachment3D" parent="."]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(PARENT_RULE);
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.message).toContain('Node3D');
  });

  it('warns for an attachment used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Attachment" type="BoneAttachment3D"]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('scene root');
  });

  it('stays quiet away from a Skeleton3D once an external one is named', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../Skeleton3D")
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns when the external flag is on but no path is given', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(EXTERNAL_RULE);
    expect(found[0]!.severity).toBe('warning');
  });

  // `_update_external_skeleton_cache` fills the cache only when `has_node` is
  // true and the node casts to Skeleton3D (cpp:81-92). Either miss leaves
  // `external_skeleton_node_cache.is_null()` true at cpp:64, so Godot warns.
  it('warns when the external path names no reachable node', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("Skeleton3D")
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(EXTERNAL_RULE);
    expect(found[0]!.message).toContain('names no node reachable');
  });

  it('warns when the external path resolves to something that is not a Skeleton3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="NotABone" type="MeshInstance3D" parent="."]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../NotABone")
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('MeshInstance3D');
  });

  it('warns when the external path is present but empty', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("")
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(EXTERNAL_RULE);
  });

  it('reports the parent only once, never both warnings at the same time', () => {
    // The two branches are the two arms of one `if`
    // (bone_attachment_3d.cpp:63-72): with the flag off, the external path is
    // not consulted at all.
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = false
external_skeleton = NodePath("")
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(PARENT_RULE);
  });

  it('stays quiet under a parent BoneAttachment3D, whose external skeleton it inherits', () => {
    // bone_attachment_3d.cpp:93-108: with the flag on and an empty path, the
    // cache is taken from a parent BoneAttachment3D's own external skeleton, so
    // the empty path here is a legitimate authoring state.
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Skeleton3D" type="Skeleton3D" parent="."]

[node name="Attachment" type="BoneAttachment3D" parent="."]
use_external_skeleton = true
external_skeleton = NodePath("../Skeleton3D")

[node name="Child" type="BoneAttachment3D" parent="Attachment"]
use_external_skeleton = true
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found.map((d) => d.nodeName)).toEqual([]);
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Attachment" type="BoneAttachment3D" parent="Rig"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean', () => {
    // Whole-file check of the "zero errors and zero warnings" claim, for the rule half. The
    // validator half lives in linterParser.test.ts.
    const content = readFixture('unit-bone-attachment-3d.tscn');
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });
});
