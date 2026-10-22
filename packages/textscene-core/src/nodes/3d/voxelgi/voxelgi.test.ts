/**
 * VoxelGI registration: parsed and validated, not yet rendered. The slice registers a base
 * component under `renderIntent: 'pending'`, so the badge reads a gap while `visible` and the
 * workspace split still behave.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { VoxelGI } from './Component';
import { parseVoxelGI } from './parser';
import './index';
import './index.r3f';

describe('VoxelGI registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('VoxelGI')?.parser).toBe(parseVoxelGI);
  });

  it('registers its own component, the base with the gizmo', () => {
    expect(nodeComponentRegistry.get('VoxelGI')).toBe(VoxelGI);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('VoxelGI')).toBe('pending');
    expect(rendersOwnVisual('VoxelGI')).toBe('not-implemented');
  });
});
