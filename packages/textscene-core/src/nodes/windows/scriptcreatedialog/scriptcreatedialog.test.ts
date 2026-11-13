/**
 * ScriptCreateDialog registration: parsed and validated, drawing nothing. A game cannot
 * create it, so the registration declares a transform-only group.
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

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('ScriptCreateDialog')).toBe('transform-only');
    expect(rendersOwnVisual('ScriptCreateDialog')).toBe('transform-only');
  });
});
