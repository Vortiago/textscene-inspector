/**
 * VFlowContainer registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../control/parser';
import './index';

describe('VFlowContainer registration', () => {
  it('registers the Control base parser', () => {
    const registration = nodeRegistry.getRegistration('VFlowContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('VFlowContainer')).toBeUndefined();
  });
});
