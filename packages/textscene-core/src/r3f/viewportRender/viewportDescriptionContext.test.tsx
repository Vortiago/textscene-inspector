import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ViewportDescriptionProvider, useViewportDescription } from './viewportDescriptionContext';
import { rootViewportDescription } from './viewportDescription';
import { withProject } from '../testing/ProjectFixture';

describe('useViewportDescription', () => {
  it('reads the description of the viewport a subtree draws in', () => {
    const own = { ...rootViewportDescription(null), mipmapBias: 1.5 };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportDescriptionProvider description={own}>{children}</ViewportDescriptionProvider>
    );

    expect(renderHook(() => useViewportDescription(), { wrapper }).result.current).toBe(own);
  });

  it("reads the root's description outside every SubViewport (edge case)", () => {
    const { result } = renderHook(() => useViewportDescription(), { wrapper: withProject(null) });

    expect(result.current).toEqual(rootViewportDescription(null));
  });
});
