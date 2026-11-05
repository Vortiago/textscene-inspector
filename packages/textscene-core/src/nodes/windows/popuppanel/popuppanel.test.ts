/**
 * PopupPanel registration: parsed, validated and drawn as an embedded window.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseWindow } from '../window/parser';
import './index';
import './index.r3f';

describe('PopupPanel registration', () => {
  it('registers the Window parse, which reads the class defaults', () => {
    const registration = nodeRegistry.getRegistration('PopupPanel');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseWindow);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('PopupPanel')).toBe('draws');
    expect(rendersOwnVisual('PopupPanel')).toBe('draws');
  });
});
