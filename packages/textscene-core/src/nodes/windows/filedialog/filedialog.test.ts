/**
 * FileDialog registration: parsed and validated, not yet rendered. The base
 * component under `renderIntent: 'pending'` makes the badge read a gap. The `Node`
 * base applies no `visible`, so the registration adds only that declared gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseNode } from '../../node/parser';
import './index';
import './index.r3f';

describe('FileDialog registration', () => {
  it('registers the parseNode parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('FileDialog');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('FileDialog')).toBe('pending');
    expect(rendersOwnVisual('FileDialog')).toBe('not-implemented');
  });
});
