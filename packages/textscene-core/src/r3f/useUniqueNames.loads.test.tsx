/**
 * A reader of the `%Name` tables re-renders on a load only where its answer changes: a scene
 * that loads elsewhere costs it no render, and a base that its inherited root waits for does.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useLocalScene, useUniqueNamePaths } from './useUniqueNames.js';

const LOADS = 20;

const PLAIN = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Hud" type="Node3D" parent="."]
unique_name_in_owner = true
`;

const INHERITING = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Main" instance=ExtResource("base")]
`;

const BASE = `[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="Hand" type="Node3D" parent="."]
unique_name_in_owner = true
`;

function mount(main: string) {
  const fake = createFakeResourceLoader();
  const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(main));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    </HierarchyProvider>
  );
  const loadElsewhere = (times: number) => {
    for (let i = 0; i < times; i++) {
      act(() => fake.eventBus.emit('scene', 'loaded', `res://other${i}.tscn`, {}));
    }
  };
  return { fake, wrapper, loadElsewhere };
}

/** `useHook` rendered under `wrapper`, with the count of its renders. */
function countRenders<T>(useHook: () => T, wrapper: ({ children }: { children: ReactNode }) => ReactNode) {
  const renders = { count: 0 };
  const view = renderHook(
    () => {
      renders.count++;
      return useHook();
    },
    { wrapper }
  );
  return { ...view, renders };
}

describe('a reader of the %Name tables on a load', () => {
  it('does not render again for the table of the outer root', () => {
    const { wrapper, loadElsewhere } = mount(PLAIN);
    const { renders } = countRenders(() => useUniqueNamePaths(null), wrapper);
    const afterMount = renders.count;

    loadElsewhere(LOADS);

    expect(renders.count).toBe(afterMount);
  });

  it('does not render again for the table of a node at a path', () => {
    const { wrapper, loadElsewhere } = mount(PLAIN);
    const { renders } = countRenders(() => useUniqueNamePaths('Main/Hud'), wrapper);
    const afterMount = renders.count;

    loadElsewhere(LOADS);

    expect(renders.count).toBe(afterMount);
  });

  it('does not render again for the local scene of a node', () => {
    const { wrapper, loadElsewhere } = mount(PLAIN);
    const { renders } = countRenders(() => useLocalScene('Main/Hud'), wrapper);
    const afterMount = renders.count;

    loadElsewhere(LOADS);

    expect(renders.count).toBe(afterMount);
  });

  it('does not render again for a local scene with no path', () => {
    const { wrapper, loadElsewhere } = mount(PLAIN);
    const { renders } = countRenders(() => useLocalScene(null), wrapper);
    const afterMount = renders.count;

    loadElsewhere(LOADS);

    expect(renders.count).toBe(afterMount);
  });

  it('shows a name from the base its inherited root waits for', () => {
    const { fake, wrapper } = mount(INHERITING);
    const { result } = renderHook(() => useUniqueNamePaths(null), { wrapper });
    expect(result.current?.get('%Hand')).toBeUndefined();

    act(() => fake.scenes._resolve('res://base.tscn', new TscnParser().parse(BASE)));

    expect(result.current?.get('%Hand')).toBe('Main/Hand');
  });
});
