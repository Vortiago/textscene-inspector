import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { nodeEscapesParent } from './nodeEscapesParent.js';

function node(type: string, extra: Partial<TscnNode> = {}): TscnNode {
  return { name: 'N', type, children: [], properties: {}, ...extra };
}

describe('nodeEscapesParent', () => {
  it('frees a plain Node from a Node3D parent', () => {
    expect(nodeEscapesParent(node('Node'), 'Node3D')).toBe(true);
  });

  it('keeps a Node3D under a Node3D parent', () => {
    expect(nodeEscapesParent(node('MeshInstance3D'), 'Node3D')).toBe(false);
  });

  it('keeps any node under a parent in no family', () => {
    expect(nodeEscapesParent(node('Node3D'), null)).toBe(false);
  });

  it('keeps an instance in place, since its class is the sub-scene root’s', () => {
    expect(nodeEscapesParent(node('Node', { instance: 'ExtResource("1")' }), 'Node3D')).toBe(false);
  });

  it('keeps an override heading in place, since its class is the instanced node’s', () => {
    expect(nodeEscapesParent(node('Node', { overridesExistingNode: true }), 'Node3D')).toBe(false);
  });
});
