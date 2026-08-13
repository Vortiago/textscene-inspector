/**
 * ConfirmationDialog registration — parsed and validated, not yet rendered.
 *
 * The slice registers a base component under `renderIntent: 'pending'`, so the
 * badge reads a gap. The `Node` base applies no `visible` and an unregistered
 * type already sat in both canvases, so unlike the Node2D/Node3D-based pending
 * slices this registration buys the declared gap alone.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseNode } from '../../node/parser';
import './index';
import './index.r3f';

describe('ConfirmationDialog registration', () => {
  it('registers the Node base parser', () => {
    const registration = nodeRegistry.getRegistration('ConfirmationDialog');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('ConfirmationDialog')).toBe('pending');
    expect(rendersOwnVisual('ConfirmationDialog')).toBe('not-implemented');
  });
});
