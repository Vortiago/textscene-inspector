/**
 * Window registration: parsed, validated and drawn as an embedded window.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseWindow } from './parser';
import './index';
import './index.r3f';

describe('Window registration', () => {
  it('registers the Window parse, which reads the class defaults', () => {
    const registration = nodeRegistry.getRegistration('Window');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseWindow);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('Window')).toBe('draws');
    expect(rendersOwnVisual('Window')).toBe('draws');
  });
});
