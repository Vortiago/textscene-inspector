import { describe, expect, it } from 'vitest';
import { isInstanceBelowRoot, isOwnedByRoot } from './nodeOwner.js';
import type { RawNode } from './types.js';

function rawNode(fields: Partial<RawNode> = {}): RawNode {
  return { name: 'Node', type: 'Node3D', rawProperties: {}, children: [], ...fields };
}

describe('isInstanceBelowRoot', () => {
  it('is true for an instance heading below the root', () => {
    expect(isInstanceBelowRoot(rawNode({ instance: 'ExtResource("1")' }), false)).toBe(true);
  });

  it('is false for a heading that instances nothing', () => {
    expect(isInstanceBelowRoot(rawNode(), false)).toBe(false);
  });

  it('is false for an instanced root, which is the scene root itself', () => {
    expect(isInstanceBelowRoot(rawNode({ instance: 'ExtResource("1")' }), true)).toBe(false);
  });
});

describe('isOwnedByRoot', () => {
  it('is true for a node outside any instance', () => {
    expect(isOwnedByRoot(rawNode(), false)).toBe(true);
  });

  it('is false for an override heading inside an instance, which keeps the sub-scene owner', () => {
    expect(isOwnedByRoot(rawNode({ overridesExistingNode: true }), true)).toBe(false);
  });

  it('follows an explicit owner= over the structural answer', () => {
    expect(isOwnedByRoot(rawNode({ overridesExistingNode: true, owner: '.' }), true)).toBe(true);
    expect(isOwnedByRoot(rawNode({ owner: 'Player' }), false)).toBe(false);
  });
});
