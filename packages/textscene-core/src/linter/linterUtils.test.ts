/** Tests for the shared scene-index helpers used by the semantic linters.
 *
 * NodePath RESOLUTION lives in `nodePathResolve.test.ts`, beside the port of
 * `Node::get_node_or_null` that replaced the name-matching form this file used
 * to cover. */

import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { findNodesByName } from './linterUtils.js';

function node(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: {} };
}

describe('findNodesByName', () => {
  it('collects every match depth-first', () => {
    const a = node('X', 'Node3D');
    const b = node('X', 'Label3D');
    const root = node('Root', 'Node3D', [a, node('G', 'Node3D', [b])]);

    expect(findNodesByName([root], 'X')).toEqual([a, b]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findNodesByName([node('Root', 'Node3D')], 'Nope')).toEqual([]);
  });
});
