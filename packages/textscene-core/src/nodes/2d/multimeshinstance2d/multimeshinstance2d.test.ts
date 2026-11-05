/** MultiMeshInstance2D registration: its own parser, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import './index';
import './index.r3f';
import { parseMultiMeshInstance2D } from './parser';

describe('MultiMeshInstance2D registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('MultiMeshInstance2D')!.parser).toBe(parseMultiMeshInstance2D);
  });

  it('registers a component that draws', () => {
    expect(nodeComponentRegistry.renderIntentOf('MultiMeshInstance2D')).toBe('draws');
    expect(rendersOwnVisual('MultiMeshInstance2D')).toBe('draws');
  });
});
