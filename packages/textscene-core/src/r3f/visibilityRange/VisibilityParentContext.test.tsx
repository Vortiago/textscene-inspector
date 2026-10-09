import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { VisibilityParentScope, useVisibilityParent } from './VisibilityParentContext';
import type { TscnNode } from '../../parser/types';

function node(type: string, visibilityParent?: string): TscnNode {
  return {
    rawProperties: {},
    name: 'N',
    type,
    children: [],
    properties: { name: 'N', visibility_parent: visibilityParent },
  };
}

interface Level {
  node: TscnNode;
  path: string;
}

/** The visibility parent read below `levels`, outermost first. */
function visibilityParentBelow(...levels: Level[]): string | null {
  const wrapper = ({ children }: { children: ReactNode }) =>
    levels.reduceRight<ReactNode>(
      (inner, level) => (
        <VisibilityParentScope node={level.node} path={level.path}>
          {inner}
        </VisibilityParentScope>
      ),
      children
    );
  return renderHook(() => useVisibilityParent(), { wrapper }).result.current;
}

describe('VisibilityParentScope', () => {
  it('has no visibility parent outside every scope', () => {
    expect(visibilityParentBelow()).toBeNull();
  });

  it("resolves a Node3D's own path against the node itself", () => {
    expect(visibilityParentBelow({ node: node('MeshInstance3D', '../Proxy'), path: 'Root/Detail' })).toBe(
      'Root/Proxy'
    );
  });

  it("passes a Node3D's visibility parent down to a Node3D with no path of its own", () => {
    const detail = { node: node('Node3D', '../Proxy'), path: 'Root/Detail' };
    const part = { node: node('MeshInstance3D'), path: 'Root/Detail/Part' };
    expect(visibilityParentBelow(detail, part)).toBe('Root/Proxy');
  });

  it('gives none below a node outside the Node3D family', () => {
    const detail = { node: node('Node3D', '../Proxy'), path: 'Root/Detail' };
    const plain = { node: node('Node'), path: 'Root/Detail/Plain' };
    expect(visibilityParentBelow(detail, plain)).toBeNull();
  });

  it('gives none for a path to the node itself', () => {
    expect(visibilityParentBelow({ node: node('MeshInstance3D', '.'), path: 'Root/Detail' })).toBeNull();
  });

  it('gives none for an absolute path, which only the live SceneTree resolves', () => {
    expect(
      visibilityParentBelow({ node: node('MeshInstance3D', '/root/Proxy'), path: 'Root/Detail' })
    ).toBeNull();
  });
});
