/**
 * ConeTwistJoint3D registration — it is parsed, and it draws nothing on purpose
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

describe('ConeTwistJoint3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('ConeTwistJoint3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('ConeTwistJoint3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('ConeTwistJoint3D')).toBe(true);
  });

  it('reads swing_span and bias nowhere: parseNode3D only knows transform and visible', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MyConeTwistJoint3D" type="ConeTwistJoint3D" parent="."]\n' +
        'swing_span = 999.0\n' +
        'bias = "not-a-number"\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.properties).not.toHaveProperty('swing_span');
    expect(node?.properties).not.toHaveProperty('bias');
    expect(node?.rawProperties?.swing_span).toBe('999.0');
    expect(node?.rawProperties?.bias).toBe('"not-a-number"');
  });
});
