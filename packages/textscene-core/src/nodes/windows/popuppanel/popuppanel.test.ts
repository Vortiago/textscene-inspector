/**
 * PopupPanel registration: parsed and validated, not yet rendered. The pending
 * registration makes the badge read a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseWindow } from '../window/parser';
import './index';
import './index.r3f';

describe('PopupPanel registration', () => {
  it('registers the Window parse, which reads the class defaults', () => {
    const registration = nodeRegistry.getRegistration('PopupPanel');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseWindow);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('PopupPanel')).toBe('pending');
    expect(rendersOwnVisual('PopupPanel')).toBe('not-implemented');
  });
});
