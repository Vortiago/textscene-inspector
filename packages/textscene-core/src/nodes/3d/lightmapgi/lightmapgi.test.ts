/** LightmapGI registration: its own parser, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseLightmapGI } from './parser';
import { LightmapGI } from './Component';
import './index';
import './index.r3f';

describe('LightmapGI registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('LightmapGI')!.parser).toBe(parseLightmapGI);
  });

  it('registers its component as one that draws', () => {
    expect(nodeComponentRegistry.get('LightmapGI')).toBe(LightmapGI);
    expect(rendersOwnVisual('LightmapGI')).toBe('draws');
  });
});
