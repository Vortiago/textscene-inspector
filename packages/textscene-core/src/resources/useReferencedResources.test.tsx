import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../parser/types';
import { SceneResourcesProvider } from '../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { useReferencedResources } from './useReferencedResources';

const CURVE: TscnInternalResource = {
  type: 'Curve',
  id: 'fade',
  data: { _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]', point_count: '2' },
};
const GRADIENT: TscnInternalResource = {
  type: 'Gradient',
  id: 'ramp',
  data: { offsets: 'PackedFloat32Array(0, 1)', colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' },
};

const LOADER = createFakeResourceLoader().loader;
const SCENE = [CURVE, GRADIENT];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ResourceLoaderProvider loader={LOADER}>
      <SceneResourcesProvider internalResources={SCENE}>{children}</SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('useReferencedResources', () => {
  it('resolves a curve and a gradient SubResource, one entry per reference in order', () => {
    const { result } = renderHook(
      () => useReferencedResources([undefined, 'SubResource("fade")'], ['SubResource("ramp")']),
      { wrapper }
    );
    expect(result.current.curves[0]).toBeNull();
    expect(result.current.curves[1]?.points).toHaveLength(2);
    expect(result.current.gradients[0]?.stops).toHaveLength(2);
  });

  it('answers null for a reference the scene does not define, and for a resource of the other type', () => {
    const { result } = renderHook(
      () =>
        useReferencedResources(['SubResource("missing")', 'SubResource("ramp")'], ['SubResource("fade")']),
      { wrapper }
    );
    expect(result.current.curves).toEqual([null, null]);
    expect(result.current.gradients).toEqual([null]);
  });

  it('keeps its result across renders that build equal reference arrays', () => {
    const { result, rerender } = renderHook(
      () => useReferencedResources(['SubResource("fade")'], [undefined]),
      { wrapper }
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
