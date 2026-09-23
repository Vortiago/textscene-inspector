/**
 * Popup registration: parsed and validated, not yet rendered. The pending
 * registration makes the badge read a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseNode } from '../../node/parser';
import './index';
import './index.r3f';

describe('Popup registration', () => {
  it('registers the Node base parser', () => {
    const registration = nodeRegistry.getRegistration('Popup');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('Popup')).toBe('pending');
    expect(rendersOwnVisual('Popup')).toBe('not-implemented');
  });
});
