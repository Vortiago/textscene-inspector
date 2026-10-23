/**
 * Every consumer of the live tree over one scene graph and loader shares one live tree for a load
 * tick, so a sub-scene is read and collapsed once however many hooks ask about it.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useLiveNode } from './useLiveSceneTree.js';
import { useLocalScene, useUniqueNamePaths } from './useUniqueNames.js';

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://kid.tscn" id="kid"]

[node name="Main" type="Node3D"]

[node name="K0" parent="." instance=ExtResource("kid")]
`;

const KID = `[gd_scene format=3]

[node name="Kid" type="Node3D"]

[node name="Arm" type="Node3D" parent="."]

[node name="Head" type="Node3D" parent="Arm"]
unique_name_in_owner = true
`;

const HEAD = 'Main/K0/Arm/Head';

function mount({ seeded = true } = {}) {
  const fake = createFakeResourceLoader();
  if (seeded) fake.scenes.seed('res://kid.tscn', new TscnParser().parse(KID));
  const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(MAIN));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    </HierarchyProvider>
  );
  const kidReads = vi.spyOn(fake.scenes, 'getCached');
  const reads = () => kidReads.mock.calls.filter(([path]) => path === 'res://kid.tscn').length;
  return { fake, wrapper, reads };
}

describe('the live tree shared by its consumers', () => {
  it('reads the sub-scene once for two hooks on one tick', () => {
    const { wrapper, reads } = mount();
    renderHook(() => useUniqueNamePaths(HEAD), { wrapper });
    const afterFirst = reads();

    renderHook(() => useLocalScene(HEAD), { wrapper });

    expect(reads()).toBe(afterFirst);
  });

  it('reads the sub-scene once for a node lookup beside them', () => {
    const { wrapper, reads } = mount();
    renderHook(() => useUniqueNamePaths(HEAD), { wrapper });
    const afterFirst = reads();

    const { result } = renderHook(() => useLiveNode(HEAD), { wrapper });

    expect([result.current?.node.name, reads()]).toEqual(['Head', afterFirst]);
  });

  it('reads the sub-scene again on a new tick', () => {
    const { fake, wrapper, reads } = mount();
    renderHook(() => useUniqueNamePaths(HEAD), { wrapper });
    const afterFirst = reads();

    act(() => fake.eventBus.emit('scene', 'loaded', 'res://other.tscn', {}));
    renderHook(() => useLocalScene(HEAD), { wrapper });

    expect(reads()).toBeGreaterThan(afterFirst);
  });

  it('shows a sub-scene that loads between the first render and the first subscription', () => {
    const { fake, wrapper } = mount({ seeded: false });
    const LoadsAfterRender = () => {
      fake.scenes.seed('res://kid.tscn', new TscnParser().parse(KID));
      return null;
    };
    const wrapperWithLateLoad = ({ children }: { children: ReactNode }) =>
      wrapper({ children: [children, <LoadsAfterRender key="late" />] });

    const { result } = renderHook(() => useLiveNode(HEAD), { wrapper: wrapperWithLateLoad });

    expect(result.current?.node.name).toBe('Head');
  });
});
