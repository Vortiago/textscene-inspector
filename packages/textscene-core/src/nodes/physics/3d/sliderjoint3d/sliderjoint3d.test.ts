/**
 * SliderJoint3D registration - it is parsed, and it draws nothing on purpose
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

describe('SliderJoint3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('SliderJoint3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('SliderJoint3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('SliderJoint3D')).toBe(true);
  });

  it('reads linear_limit/upper_distance and angular_limit/upper_angle nowhere: parseNode3D only knows transform and visible', () => {
    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MySliderJoint3D" type="SliderJoint3D" parent="."]\n' +
        'linear_limit/upper_distance = 9999.0\n' +
        'angular_limit/upper_angle = "not-a-number"\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.properties).not.toHaveProperty('linear_limit/upper_distance');
    expect(node?.properties).not.toHaveProperty('angular_limit/upper_angle');
    expect(node?.rawProperties?.['linear_limit/upper_distance']).toBe('9999.0');
    expect(node?.rawProperties?.['angular_limit/upper_angle']).toBe('"not-a-number"');
  });
});
