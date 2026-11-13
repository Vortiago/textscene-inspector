/**
 * PinJoint2D registration: its own parser reads the properties its marker draws, and the node draws for
 * every node, so its sheet may not claim `linter-only`.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode2D } from '../../../base/node2d/parser';
import { PinJoint2D } from './Component';
import './index';
import './index.r3f';

describe('PinJoint2D registration', () => {
  it('registers its parser', () => {
    expect(nodeRegistry.getRegistration('PinJoint2D')!.parser).toBe(parseNode2D);
  });

  it('registers its own component', () => {
    expect(nodeComponentRegistry.get('PinJoint2D')).toBe(PinJoint2D);
  });

  it('draws, so the sheet may not claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('PinJoint2D')).toBe('draws');
  });
});
