/**
 * ConfirmationDialog registration: parsed and validated as a Window, and drawn as an embedded window.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseConfirmationDialog } from './parser';
import './index';
import './index.r3f';

describe('ConfirmationDialog registration', () => {
  it('registers the ConfirmationDialog parse', () => {
    const registration = nodeRegistry.getRegistration('ConfirmationDialog');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseConfirmationDialog);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('ConfirmationDialog')).toBe('draws');
    expect(rendersOwnVisual('ConfirmationDialog')).toBe('draws');
  });
});
