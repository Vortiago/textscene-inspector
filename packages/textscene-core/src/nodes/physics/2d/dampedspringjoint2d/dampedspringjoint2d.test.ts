/**
 * DampedSpringJoint2D registration: its own parser reads the properties its marker draws, and the node draws for
 * every node, so its sheet may not claim `linter-only`.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseDampedSpringJoint2D } from './parser';
import { DampedSpringJoint2D } from './Component';
import './index';
import './index.r3f';

describe('DampedSpringJoint2D registration', () => {
  it('registers its parser', () => {
    expect(nodeRegistry.getRegistration('DampedSpringJoint2D')!.parser).toBe(parseDampedSpringJoint2D);
  });

  it('registers its own component', () => {
    expect(nodeComponentRegistry.get('DampedSpringJoint2D')).toBe(DampedSpringJoint2D);
  });

  it('draws, so the sheet may not claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('DampedSpringJoint2D')).toBe('draws');
  });
});
