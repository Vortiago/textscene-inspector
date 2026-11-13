/**
 * PopupMenu registration: parsed, validated and drawn as an embedded window.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parsePopupMenu } from './parser';
import './index';
import './index.r3f';

describe('PopupMenu registration', () => {
  it('registers the parse that reads the items', () => {
    const registration = nodeRegistry.getRegistration('PopupMenu');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parsePopupMenu);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('PopupMenu')).toBe('draws');
    expect(rendersOwnVisual('PopupMenu')).toBe('draws');
  });
});
