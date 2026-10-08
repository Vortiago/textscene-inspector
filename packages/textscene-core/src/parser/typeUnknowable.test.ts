import { describe, expect, it } from 'vitest';
import { rootStatesNoIdentifier } from './typeUnknowable.js';
import type { RawNode } from './types.js';

const root: RawNode = { name: 'Root', type: 'Node3D', rawProperties: {}, children: [] };

describe('rootStatesNoIdentifier', () => {
  it('is true for a root that overrides an existing node', () => {
    expect(rootStatesNoIdentifier({ ...root, overridesExistingNode: true })).toBe(true);
  });

  it('is true for an InstancePlaceholder root', () => {
    expect(rootStatesNoIdentifier({ ...root, type: 'InstancePlaceholder' })).toBe(true);
  });

  it('is false for a typed root, and for no root', () => {
    expect(rootStatesNoIdentifier(root)).toBe(false);
    expect(rootStatesNoIdentifier(undefined)).toBe(false);
  });
});
