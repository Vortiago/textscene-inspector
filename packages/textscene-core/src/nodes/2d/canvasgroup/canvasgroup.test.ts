/** CanvasGroup registration: its own parse, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseCanvasGroup } from './parser';
import './index';
import './index.r3f';

describe('CanvasGroup registration', () => {
  it('registers its own parse', () => {
    expect(nodeRegistry.getRegistration('CanvasGroup')!.parser).toBe(parseCanvasGroup);
  });

  it('registers a component that draws', () => {
    expect(nodeComponentRegistry.renderIntentOf('CanvasGroup')).toBe('draws');
    expect(rendersOwnVisual('CanvasGroup')).toBe('draws');
  });
});
