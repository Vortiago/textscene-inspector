/** The tree reads and copies that the `%Name` table and the seating share. */

import { describe, expect, it } from 'vitest';
import { replacedAt } from './instanceNameTable';
import type { LiveNode } from './liveNode';

const node = (name: string, children: LiveNode[] = []): LiveNode => ({
  rawProperties: {},
  type: 'Node3D',
  name,
  properties: {},
  children,
});

describe('replacedAt', () => {
  it('replaces the node at the end of the path with what the replace returns for it', () => {
    const tree = [node('A', [node('B'), node('C')])];
    const replaced = replacedAt(tree, ['A', 'C'], (at) => ({ ...at, type: `${at.type}!` }));
    expect(replaced[0]!.children.map(({ name, type }) => `${name}:${type}`)).toEqual([
      'B:Node3D',
      'C:Node3D!',
    ]);
  });

  it('copies the nodes along the path and shares every other node', () => {
    const b = node('B');
    const tree = [node('A', [b, node('C')]), node('D')];
    const replaced = replacedAt(tree, ['A', 'C'], (at) => ({ ...at }));
    expect(tree[0]!.children[1]!.type).toBe('Node3D');
    expect(replaced).not.toBe(tree);
    expect(replaced[0]).not.toBe(tree[0]);
    expect(replaced[0]!.children[0]).toBe(b);
    expect(replaced[1]).toBe(tree[1]);
  });

  it('throws, naming the path, where the path names no node', () => {
    expect(() => replacedAt([node('A')], ['A', 'Lost'], (at) => at)).toThrow('A/Lost');
  });
});
