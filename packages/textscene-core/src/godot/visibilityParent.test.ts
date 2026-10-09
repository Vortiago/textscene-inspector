import { describe, expect, it } from 'vitest';
import { visibilityParentOf } from './visibilityParent';

describe('visibilityParentOf', () => {
  it('resolves its own path against the node itself', () => {
    expect(visibilityParentOf('Root/Detail', '../Proxy', null)).toBe('Root/Proxy');
  });

  it('takes the inherited one when the node has no path of its own', () => {
    expect(visibilityParentOf('Root/Detail', undefined, 'Root/Proxy')).toBe('Root/Proxy');
  });

  it('gives none for an absolute path, which only the live SceneTree resolves', () => {
    expect(visibilityParentOf('Root/Detail', '/root/Proxy', 'Root/Other')).toBeNull();
  });

  it('gives none for a path to the node itself (edge case)', () => {
    expect(visibilityParentOf('Root/Detail', '.', 'Root/Other')).toBeNull();
  });

  it('resolves a %Name through the unique paths', () => {
    const uniquePaths = new Map([['%Proxy', 'Root/Deep/Proxy']]);
    expect(visibilityParentOf('Root/Detail', '%Proxy', null, uniquePaths)).toBe('Root/Deep/Proxy');
  });
});
