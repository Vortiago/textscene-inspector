/**
 * GrooveJoint2D registration: its own parser reads the properties its marker draws, and the node draws for
 * every node, so its sheet may not claim `linter-only`.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseGrooveJoint2D } from './parser';
import { GrooveJoint2D } from './Component';
import './index';
import './index.r3f';

describe('GrooveJoint2D registration', () => {
  it('registers its parser', () => {
    expect(nodeRegistry.getRegistration('GrooveJoint2D')!.parser).toBe(parseGrooveJoint2D);
  });

  it('registers its own component', () => {
    expect(nodeComponentRegistry.get('GrooveJoint2D')).toBe(GrooveJoint2D);
  });

  it('draws, so the sheet may not claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('GrooveJoint2D')).toBe('draws');
  });
});
