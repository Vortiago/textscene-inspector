/**
 * VisibleOnScreenNotifier2D registration: it is parsed, and it draws nothing on purpose
 * (ADR-0008), not for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseNode2D } from '../../base/node2d/parser';
import { Node2D } from '../../base/node2d/Component';
import './index';
import './index.r3f';

describe('VisibleOnScreenNotifier2D registration', () => {
  it('registers the Node2D base parser', () => {
    const registration = nodeRegistry.getRegistration('VisibleOnScreenNotifier2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('reuses the Node2D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('VisibleOnScreenNotifier2D')).toBe(Node2D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('VisibleOnScreenNotifier2D')).toBe(true);
  });
});
