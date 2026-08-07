/**
 * Tests for the RemoteTransform3D remote_path rule
 * (`remotetransform3d-invalid-remote-path`).
 *
 * Driven through `StrictTscnParser` and the rule's own `check`, not through
 * `Linter`: `Linter` imports the linter barrel, which loads every slice in the
 * repo and so cannot run while sibling slices are being written. The parse is
 * still the real one, so the properties the rule reads are the ones a scene
 * really produces.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import { remoteTransform3DValidationRule } from './linter';
import './linterParser';

/** Every diagnostic the rule reports for the RemoteTransform3D in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error('fixture failed to parse');
  const node = scene.nodes[0]?.children.find((child) => child.type === 'RemoteTransform3D');
  expect(node, 'the fixture text must contain a RemoteTransform3D child').toBeDefined();
  return remoteTransform3DValidationRule.check({ scene, node: node!, properties: node!.properties });
}

/** A RemoteTransform3D carrying `body`, with a Node3D and a non-Node3D sibling to point at. */
function scene(body: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Target" type="MeshInstance3D" parent="."]

[node name="NotSpatial" type="Node" parent="."]

[node name="Relay" type="RemoteTransform3D" parent="."]
${body}`;
}

describe('RemoteTransform3D remote_path rule', () => {
  it('warns when remote_path is absent (remote_transform_3d.h:38 default is NodePath())', () => {
    const warnings = warningsFor(scene(''));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.ruleName).toBe('remotetransform3d-invalid-remote-path');
  });

  it('warns on an explicit empty NodePath, same as the default', () => {
    expect(warningsFor(scene('remote_path = NodePath("")\n'))).toHaveLength(1);
  });

  it('stays silent when remote_path resolves to a Node3D', () => {
    // resolveNodePathTarget resolves the FINAL segment by name across the whole
    // tree (linterUtils.ts), not real relative-path semantics — a bare name
    // matches its sibling "Target" the same way gpuparticles3d's sub_emitter
    // tests reference a sibling without "..".
    expect(warningsFor(scene('remote_path = NodePath("Target")\n'))).toEqual([]);
  });

  it('warns when remote_path names no node in this file', () => {
    const warnings = warningsFor(scene('remote_path = NodePath("NoSuchNode")\n'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('NoSuchNode');
  });

  it('warns when remote_path resolves to a node that is not a Node3D', () => {
    const warnings = warningsFor(scene('remote_path = NodePath("NotSpatial")\n'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('Node');
  });

  it('stays silent on an escaping relative path rather than guessing', () => {
    expect(warningsFor(scene('remote_path = NodePath("../../Elsewhere")\n'))).toEqual([]);
  });

  it('leaves the committed fixture warning-free', () => {
    expect(warningsFor(readFixture('unit-remote-transform-3d.tscn'))).toEqual([]);
  });
});
