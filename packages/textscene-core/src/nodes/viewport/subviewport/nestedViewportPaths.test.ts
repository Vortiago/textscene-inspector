/**
 * `collectNestedViewportPaths` — the `dependsOn` a viewport pass registers
 * with the ordered pass driver (`passOrder.ts`): every OTHER viewport
 * boundary nested inside this one's own subtree, since any of them might be
 * sampled (a `ViewportTexture` on content somewhere in this subtree) and must
 * therefore render first.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import { collectNestedViewportPaths } from './nestedViewportPaths';

function node(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name } } as TscnNode;
}

describe('collectNestedViewportPaths', () => {
  it('finds nothing under a viewport with no nested viewport', () => {
    const root = node('Viewport', 'SubViewport', [node('Panel', 'Panel')]);
    expect(collectNestedViewportPaths(root, 'Root/Viewport')).toEqual([]);
  });

  it('finds a directly nested SubViewport, joined onto the parent path', () => {
    const root = node('Outer', 'SubViewport', [node('Inner', 'SubViewport')]);
    expect(collectNestedViewportPaths(root, 'Root/Outer')).toEqual(['Root/Outer/Inner']);
  });

  it('finds a SubViewport nested arbitrarily deep through non-viewport ancestors', () => {
    const root = node('Outer', 'SubViewport', [
      node('Container', 'SubViewportContainer', [node('Inner', 'SubViewport')]),
    ]);
    expect(collectNestedViewportPaths(root, 'Root/Outer')).toEqual([
      'Root/Outer/Container/Inner',
    ]);
  });

  it('does not descend past a found nested viewport — its own subtree is its own pass concern', () => {
    const root = node('Outer', 'SubViewport', [
      node('Middle', 'SubViewport', [node('Inner', 'SubViewport')]),
    ]);
    expect(collectNestedViewportPaths(root, 'Root/Outer')).toEqual(['Root/Outer/Middle']);
  });

  it('finds every sibling nested viewport', () => {
    const root = node('Outer', 'SubViewport', [
      node('A', 'SubViewport'),
      node('B', 'SubViewport'),
    ]);
    expect(collectNestedViewportPaths(root, 'Root/Outer')).toEqual([
      'Root/Outer/A',
      'Root/Outer/B',
    ]);
  });
});
