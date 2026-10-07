/**
 * `useInstancedScene` registers an instance's PackedScene ExtResource and loads
 * the scene. The scene load checks the registered type, so the registration
 * must land before the request.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useInstancedScene } from './useInstancedScene';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  recordSceneRequests,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnScene } from '../../parser/types';

const SCENE_PATH = 'res://child.tscn';
const INSTANCE_REF = 'ExtResource("1_child")';
const EXTERNAL_RESOURCES: readonly TscnExternalResource[] = [
  { id: '1_child', path: SCENE_PATH, type: 'PackedScene' },
];
const CHILD_SCENE: TscnScene = { nodes: [], externalResources: [], internalResources: [] };

function wrapper(fake: FakeResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
  };
}

describe('useInstancedScene', () => {
  it('registers the PackedScene metadata before the scene load requests it', () => {
    const fake = createFakeResourceLoader();
    const metadataAtRequest = recordSceneRequests(fake);

    renderHook(() => useInstancedScene(INSTANCE_REF, EXTERNAL_RESOURCES, SCENE_PATH), {
      wrapper: wrapper(fake),
    });

    expect(metadataAtRequest.get(SCENE_PATH)).toBe(true);
  });

  it('registers a path with redundant slashes under the simplified path the load requests', () => {
    const fake = createFakeResourceLoader();
    const metadataAtRequest = recordSceneRequests(fake);
    const unsimplified = [{ id: '1_child', path: 'res:///child.tscn', type: 'PackedScene' }];

    renderHook(() => useInstancedScene(INSTANCE_REF, unsimplified, SCENE_PATH), { wrapper: wrapper(fake) });

    expect(metadataAtRequest.get(SCENE_PATH)).toBe(true);
  });

  it('returns the scene once its load resolves', () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useInstancedScene(INSTANCE_REF, EXTERNAL_RESOURCES, SCENE_PATH), {
      wrapper: wrapper(fake),
    });

    act(() => fake.scenes._resolve(SCENE_PATH, CHILD_SCENE));

    expect(result.current).toEqual({ value: CHILD_SCENE, status: 'loaded' });
  });

  it('neither registers nor loads with no load path', () => {
    const fake = createFakeResourceLoader();
    const metadataAtRequest = recordSceneRequests(fake);

    const { result } = renderHook(() => useInstancedScene(INSTANCE_REF, EXTERNAL_RESOURCES, null), {
      wrapper: wrapper(fake),
    });

    expect(fake.registerCalls).toEqual([]);
    expect(metadataAtRequest.size).toBe(0);
    expect(result.current.status).toBe('pending');
  });

  it('registers nothing for an ExtResource id the scene does not declare', () => {
    const fake = createFakeResourceLoader();

    renderHook(() => useInstancedScene('ExtResource("9_missing")', EXTERNAL_RESOURCES, SCENE_PATH), {
      wrapper: wrapper(fake),
    });

    expect(fake.registerCalls).toEqual([]);
  });
});
