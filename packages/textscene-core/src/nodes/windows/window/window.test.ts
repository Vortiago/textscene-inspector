/**
 * Window registration: parsed and validated, not yet rendered. The pending
 * registration makes the badge read a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseWindow } from './parser';
import './index';
import './index.r3f';

describe('Window registration', () => {
  it('registers the Window parse, which reads the class defaults', () => {
    const registration = nodeRegistry.getRegistration('Window');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseWindow);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('Window')).toBe('pending');
    expect(rendersOwnVisual('Window')).toBe('not-implemented');
  });
});
