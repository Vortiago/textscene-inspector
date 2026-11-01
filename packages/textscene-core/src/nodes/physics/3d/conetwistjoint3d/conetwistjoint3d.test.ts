/** ConeTwistJoint3D registration: it is parsed with its spans and drawn by a component of its own. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../../parser/TscnParser';
import { ConeTwistJoint3D } from './Component';
import { parseConeTwistJoint3D } from './parser';
import './index';
import './index.r3f';

describe('ConeTwistJoint3D registration', () => {
  it('registers the cone-twist parser', () => {
    expect(nodeRegistry.getRegistration('ConeTwistJoint3D')!.parser).toBe(parseConeTwistJoint3D);
  });

  it('registers its own component, with no transform-only render intent', () => {
    expect(nodeComponentRegistry.get('ConeTwistJoint3D')).toBe(ConeTwistJoint3D);
    expect(nodeComponentRegistry.renderIntentOf('ConeTwistJoint3D')).not.toBe('transform-only');
  });

  it('reads the spans from a scene file and leaves bias unread', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MyConeTwistJoint3D" type="ConeTwistJoint3D" parent="."]\n' +
        'swing_span = 0.5\n' +
        'bias = "not-a-number"\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.properties).toMatchObject({ swing_span: 0.5 });
    expect(node?.properties).not.toHaveProperty('bias');
    expect(node?.rawProperties.bias).toBe('"not-a-number"');
  });
});
