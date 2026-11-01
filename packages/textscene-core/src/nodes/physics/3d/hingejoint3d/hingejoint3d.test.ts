/** HingeJoint3D registration: it is parsed with its limits and drawn by a component of its own. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { HingeJoint3D } from './Component';
import { parseHingeJoint3D } from './parser';
import './index';
import './index.r3f';

describe('HingeJoint3D registration', () => {
  it('registers the hinge parser', () => {
    expect(nodeRegistry.getRegistration('HingeJoint3D')!.parser).toBe(parseHingeJoint3D);
  });

  it('registers its own component, with no transform-only render intent', () => {
    expect(nodeComponentRegistry.get('HingeJoint3D')).toBe(HingeJoint3D);
    expect(nodeComponentRegistry.renderIntentOf('HingeJoint3D')).not.toBe('transform-only');
  });
});
