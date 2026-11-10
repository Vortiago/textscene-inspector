/** Parallax2D registers its own parser and a drawing component. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { Parallax2D } from './Component';
import { parseParallax2D } from './parser';
import './index';
import './index.r3f';

describe('Parallax2D registration', () => {
  it('registers the parse that reads the scroll keys', () => {
    expect(nodeRegistry.getRegistration('Parallax2D')!.parser).toBe(parseParallax2D);
  });

  it('registers its component as a drawn node, not a declared gap', () => {
    expect(nodeComponentRegistry.get('Parallax2D')).toBe(Parallax2D);
    expect(rendersOwnVisual('Parallax2D')).toBe('draws');
  });
});
