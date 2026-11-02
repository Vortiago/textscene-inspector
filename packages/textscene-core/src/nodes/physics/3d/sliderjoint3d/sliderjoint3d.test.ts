/** SliderJoint3D registration: it is parsed with its limits and drawn by a component of its own. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { SliderJoint3D } from './Component';
import { parseSliderJoint3D } from './parser';
import './index';
import './index.r3f';

describe('SliderJoint3D registration', () => {
  it('registers the slider parser', () => {
    expect(nodeRegistry.getRegistration('SliderJoint3D')!.parser).toBe(parseSliderJoint3D);
  });

  it('registers its own component, with no transform-only render intent', () => {
    expect(nodeComponentRegistry.get('SliderJoint3D')).toBe(SliderJoint3D);
    expect(nodeComponentRegistry.renderIntentOf('SliderJoint3D')).not.toBe('transform-only');
  });
});
