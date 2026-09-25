/**
 * CanvasGroup registration: parsed and validated, not yet rendered. The slice
 * registers a base component under `renderIntent: 'pending'`, so the badge reads a
 * gap while `visible` and the workspace split still work.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseNode2D } from '../../base/node2d/parser';
import './index';
import './index.r3f';

describe('CanvasGroup registration', () => {
  it('registers the parseNode2D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('CanvasGroup');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('CanvasGroup')).toBe('pending');
    expect(rendersOwnVisual('CanvasGroup')).toBe('not-implemented');
  });
});
