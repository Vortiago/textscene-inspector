import { describe, expect, it } from 'vitest';
import { gltfBoneNodes, type ImportNode } from './gltfSkeletons';

/** Nodes from each node's parent index, -1 for a root. */
function graph(parents: readonly number[], skinned: readonly number[] = []): ImportNode[] {
  const heightOf = (node: number): number => (parents[node]! < 0 ? 0 : 1 + heightOf(parents[node]!));
  return parents.map((parent, i) => ({
    children: parents.flatMap((p, child) => (p === i ? [child] : [])),
    parent,
    height: heightOf(i),
    mesh: skinned.includes(i) ? 0 : -1,
    skin: skinned.includes(i) ? 0 : -1,
    joint: false,
  }));
}

function bones(...args: Parameters<typeof gltfBoneNodes>): number[] {
  return [...gltfBoneNodes(...args)].sort((a, b) => a - b);
}

describe('gltfBoneNodes', () => {
  it('makes each skin joint a bone and marks it a joint', () => {
    const nodes = graph([-1, 0, 1]);
    expect(bones(nodes, [[1, 2]], [], false)).toEqual([1, 2]);
    expect(nodes.map((node) => node.joint)).toEqual([false, true, true]);
  });

  it('lifts a lower root of a multi-rooted skin to its sibling’s level, and the node it passes becomes a bone', () => {
    // Root 0 holds joint 1 and node 2, which holds joint 3.
    expect(bones(graph([-1, 0, 0, 2]), [[1, 3]], [], false)).toEqual([1, 2, 3]);
  });

  it('joins two skins whose roots are siblings into one skeleton, leaving their parent a node', () => {
    expect(bones(graph([-1, 0, 0]), [[1], [2]], [], false)).toEqual([1, 2]);
  });

  it('makes the non-joint descendants bones when asked, but not a leaf skinned mesh', () => {
    expect(bones(graph([-1, 0, 0, 1], [2]), [[0]], [], true)).toEqual([0, 1, 3]);
  });

  it('makes no bones without skins or skeleton roots', () => {
    expect(bones(graph([-1, 0]), [], [], false)).toEqual([]);
  });
});
