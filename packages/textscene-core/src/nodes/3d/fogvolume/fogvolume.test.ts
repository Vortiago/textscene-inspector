/** FogVolume registration: its own parser, and a component that draws it into the volumetric fog. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseFogVolume } from './parser';
import './index';
import './index.r3f';

describe('FogVolume registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('FogVolume')?.parser).toBe(parseFogVolume);
  });

  it('registers a component that draws', () => {
    expect(rendersOwnVisual('FogVolume')).toBe('draws');
  });
});
