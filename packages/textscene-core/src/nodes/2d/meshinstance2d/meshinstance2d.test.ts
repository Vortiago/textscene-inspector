/** MeshInstance2D registration: its own parser, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import './index';
import './index.r3f';
import { parseMeshInstance2D } from './parser';

describe('MeshInstance2D registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('MeshInstance2D')!.parser).toBe(parseMeshInstance2D);
  });

  it('registers a component that draws', () => {
    expect(nodeComponentRegistry.renderIntentOf('MeshInstance2D')).toBe('draws');
    expect(rendersOwnVisual('MeshInstance2D')).toBe('draws');
  });
});
