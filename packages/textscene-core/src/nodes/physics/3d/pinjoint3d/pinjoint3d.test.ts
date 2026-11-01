/** PinJoint3D registration: it is parsed with the Joint3D surface and drawn by a component of its own. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseJoint3D } from '../joint3d/parser';
import { PinJoint3D } from './Component';
import './index';
import './index.r3f';

describe('PinJoint3D registration', () => {
  it('registers the Joint3D parser', () => {
    expect(nodeRegistry.getRegistration('PinJoint3D')!.parser).toBe(parseJoint3D);
  });

  it('registers its own component, with no transform-only render intent', () => {
    expect(nodeComponentRegistry.get('PinJoint3D')).toBe(PinJoint3D);
    expect(nodeComponentRegistry.renderIntentOf('PinJoint3D')).not.toBe('transform-only');
  });
});
