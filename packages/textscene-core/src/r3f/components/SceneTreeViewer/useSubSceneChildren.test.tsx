/**
 * `useSubSceneChildren` returns the loaded sub-scene of an instance row, and null
 * for a row with no instance ref, from the first render that lacks one.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSubSceneChildren, type SubSceneChildren } from './useSubSceneChildren';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnNode, TscnScene } from '../../../parser/types';

const SCENE_PATH = 'res://frame.tscn';
const EXTERNAL_RESOURCES: readonly TscnExternalResource[] = [
  { id: '1_frame', path: SCENE_PATH, type: 'PackedScene' },
];
const FRAME: TscnNode = { name: 'Frame', type: 'Node3D', children: [], properties: {} };
const SUB_SCENE: TscnScene = { nodes: [FRAME], externalResources: [], internalResources: [] };
const INSTANCE_ROW: TscnNode = {
  name: 'PhotoFrame',
  type: 'Node3D',
  children: [],
  properties: {},
  instance: 'ExtResource("1_frame")',
};
const PLAIN_ROW: TscnNode = { name: 'PhotoFrame', type: 'Node3D', children: [], properties: {} };

function wrapper(fake: FakeResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
  };
}

describe('useSubSceneChildren', () => {
  it('returns the sub-scene nodes once the load resolves', () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useSubSceneChildren(INSTANCE_ROW, EXTERNAL_RESOURCES), {
      wrapper: wrapper(fake),
    });

    act(() => fake.scenes._resolve(SCENE_PATH, SUB_SCENE));

    expect(result.current?.nodes).toEqual([FRAME]);
  });

  it('returns null in the first render after the instance ref goes', () => {
    const fake = createFakeResourceLoader();
    const rendered: (SubSceneChildren | null)[] = [];
    const { rerender } = renderHook(
      ({ node }: { node: TscnNode }) => {
        const children = useSubSceneChildren(node, EXTERNAL_RESOURCES);
        rendered.push(children);
        return children;
      },
      { wrapper: wrapper(fake), initialProps: { node: INSTANCE_ROW } }
    );
    act(() => fake.scenes._resolve(SCENE_PATH, SUB_SCENE));
    const rendersBeforeRemoval = rendered.length;

    rerender({ node: PLAIN_ROW });

    expect(rendered[rendersBeforeRemoval]).toBeNull();
  });
});
