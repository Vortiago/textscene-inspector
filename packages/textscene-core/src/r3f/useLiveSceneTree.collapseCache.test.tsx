/**
 * A node that may receive a host heading back reads one scene cache view that every such mount shares,
 * which stays the same object until a scene it read changes.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TscnParser } from '../parser/TscnParser.js';
import { parsedNode } from '../parser/testing/parserKit.js';
import type { TscnNode } from '../parser/types.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { useCollapseCache } from './useLiveSceneTree.js';

const SCENE_PATH = 'res://kid.tscn';

/** An instance that holds a heading below it: `parent="Kid/Arm"`. */
const ENGAGED: TscnNode = {
  ...parsedNode({ name: 'Kid', type: 'Node3D', instance: 'ExtResource("kid")' }, {}),
  children: [{ ...parsedNode({ name: 'Hat', type: 'Node3D' }, {}), instanceSubPath: 'Arm' }],
};

const PLAIN: TscnNode = parsedNode({ name: 'Kid', type: 'Node3D', instance: 'ExtResource("kid")' }, {});

function mount(node: TscnNode) {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const hook = renderHook(() => useCollapseCache(node, SCENE_PATH, null), { wrapper });
  return { fake, hook };
}

describe('useCollapseCache', () => {
  it('keeps the same view while the scenes it read are unchanged', () => {
    const { hook } = mount(ENGAGED);
    const before = hook.result.current;
    before.getCached(SCENE_PATH);

    hook.rerender();

    expect(hook.result.current).toBe(before);
  });

  it('gives a new view once a scene it read loads', () => {
    const { fake, hook } = mount(ENGAGED);
    const before = hook.result.current;
    before.getCached(SCENE_PATH);

    act(() =>
      fake.scenes._resolve(
        SCENE_PATH,
        new TscnParser().parse('[gd_scene format=3]\n\n[node name="Kid" type="Node3D"]\n')
      )
    );

    hook.rerender();

    expect(hook.result.current).not.toBe(before);
  });

  it('reads its own scene only, for a node that holds no heading', () => {
    const { fake, hook } = mount(PLAIN);
    fake.scenes.seed(
      SCENE_PATH,
      new TscnParser().parse('[gd_scene format=3]\n\n[node name="Kid" type="Node3D"]\n')
    );

    hook.rerender();

    expect(hook.result.current.getCached(SCENE_PATH)).toBeUndefined();
  });
});
