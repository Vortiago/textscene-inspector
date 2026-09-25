/**
 * ScriptCreateDialog registration: parsed and validated, not yet rendered. The pending
 * registration makes the badge read a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseNode } from '../../node/parser';
import './index';
import './index.r3f';

describe('ScriptCreateDialog registration', () => {
  it('registers the parseNode parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('ScriptCreateDialog');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('ScriptCreateDialog')).toBe('pending');
    expect(rendersOwnVisual('ScriptCreateDialog')).toBe('not-implemented');
  });
});
