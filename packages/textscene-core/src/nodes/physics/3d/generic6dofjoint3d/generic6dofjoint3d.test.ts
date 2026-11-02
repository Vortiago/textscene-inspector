/** Generic6DOFJoint3D registration: it is parsed with its limits and drawn by a component of its own. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Generic6DOFJoint3D } from './Component';
import { parseGeneric6DOFJoint3D } from './parser';
import './index';
import './index.r3f';

describe('Generic6DOFJoint3D registration', () => {
  it('registers the 6DOF parser', () => {
    expect(nodeRegistry.getRegistration('Generic6DOFJoint3D')!.parser).toBe(parseGeneric6DOFJoint3D);
  });

  it('registers its own component, with no transform-only render intent', () => {
    expect(nodeComponentRegistry.get('Generic6DOFJoint3D')).toBe(Generic6DOFJoint3D);
    expect(nodeComponentRegistry.renderIntentOf('Generic6DOFJoint3D')).not.toBe('transform-only');
  });
});
