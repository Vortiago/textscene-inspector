/** Tests for the shared scene-index helpers used by the semantic linters.
 * NodePath resolution is tested in `nodePathResolve.test.ts`. */

import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { firstNodeOfType } from './linterUtils.js';

function node(
  name: string,
  type: string,
  children: TscnNode[] = [],
  properties: Record<string, string> = {}
): TscnNode {
  return { name, type, children, properties };
}

describe('firstNodeOfType', () => {
  // `Node::Comparator` sorts a group in tree order (node.h:132-134), which is
  // depth-first pre-order, not the order the headings appear in the file.
  it('takes the first in DEPTH-FIRST order, not in file order', () => {
    const deep = node('Deep', 'WorldEnvironment');
    const shallow = node('Shallow', 'WorldEnvironment');
    const root = node('Root', 'Node3D', [node('Branch', 'Node3D', [deep]), shallow]);

    expect(firstNodeOfType([root], 'WorldEnvironment')).toBe(deep);
  });

  it('is null when the scene has no node of that type', () => {
    expect(firstNodeOfType([node('Root', 'Node3D')], 'WorldEnvironment')).toBeNull();
  });

  // Exact-name, matching `countNodesOfType`: Godot's groups are keyed by the
  // concrete class, never by a subclass closure.
  it('does not match a subclass', () => {
    expect(firstNodeOfType([node('Cam', 'Camera2D')], 'Node2D')).toBeNull();
  });

  it('skips a node that does not join the group when `joins` is given', () => {
    const bare = node('Bare', 'WorldEnvironment');
    const withEnv = node('WithEnv', 'WorldEnvironment', [], {
      environment: 'SubResource("env_1")',
    });
    const root = node('Root', 'Node3D', [bare, withEnv]);

    expect(
      firstNodeOfType([root], 'WorldEnvironment', (n) =>
        Boolean((n.properties as Record<string, string>).environment)
      )
    ).toBe(withEnv);
  });

  it('is null when nothing of that type joins the group', () => {
    const root = node('Root', 'Node3D', [node('Bare', 'WorldEnvironment')]);
    expect(firstNodeOfType([root], 'WorldEnvironment', () => false)).toBeNull();
  });
});
