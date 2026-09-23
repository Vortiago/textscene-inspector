/**
 * PhysicalBone3D registration: it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../../base/node3d/parser';
import { Node3D } from '../../../base/node3d/Component';
import { TscnParser } from '../../../../parser/TscnParser';
import './index';
import './index.r3f';

describe('PhysicalBone3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('PhysicalBone3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('PhysicalBone3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('PhysicalBone3D')).toBe(true);
  });

  it('reads bone_name and joint_type nowhere: parseNode3D only knows transform and visible', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MyPhysicalBone3D" type="PhysicalBone3D" parent="."]\n' +
        'bone_name = "not-a-real-bone"\n' +
        'joint_type = 99\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.properties).not.toHaveProperty('bone_name');
    expect(node?.properties).not.toHaveProperty('joint_type');
    expect(node?.rawProperties?.bone_name).toBe('"not-a-real-bone"');
    expect(node?.rawProperties?.joint_type).toBe('99');
  });
});
