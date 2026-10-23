/**
 * The `%Name` claim table is built once per scene tree and shared by every hook
 * over it, since every Sprite2D and MeshInstance3D asks on each re-parse. The local
 * scene a ViewportTexture measures from comes from the same live tree.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { seedGlbInstance } from '../resources/testing/seedGlbInstance.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useLocalScene, useUniqueNamePaths } from './useUniqueNames.js';

/** A root with one child, `Hud`, that claims `%Hud`. A `%Name` table exists only for a parsed tree. */
const HUD_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Hud" type="Node2D" parent="."]
unique_name_in_owner = true
`;

const graph = createSceneGraphFromTscnScene(new TscnParser().parse(HUD_SCENE));

function wrapper({ children }: { children: ReactNode }) {
  return <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>{children}</HierarchyProvider>;
}

describe('useUniqueNamePaths', () => {
  function graphWithHud(): ReturnType<typeof createSceneGraphFromTscnScene> {
    return createSceneGraphFromTscnScene(new TscnParser().parse(HUD_SCENE));
  }

  /** Renders the hook over a scene graph the returned `setGraph` swaps before a rerender. */
  function renderPaths(initial: ReturnType<typeof createSceneGraphFromTscnScene>) {
    let sceneGraph = initial;
    const view = renderHook(() => useUniqueNamePaths(null), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>{children}</HierarchyProvider>
      ),
    });
    const setGraph = (next: typeof initial) => {
      sceneGraph = next;
    };
    return { ...view, setGraph };
  }

  it('maps each claimed name to the live path of its claimant', () => {
    const { result } = renderPaths(graphWithHud());
    expect(result.current?.get('%Hud')).toBe('Root/Hud');
  });

  it('keeps the same map while a rebuilt table holds the same entries', () => {
    const view = renderPaths(graphWithHud());
    const first = view.result.current;
    view.setGraph(graphWithHud());
    view.rerender();
    expect(view.result.current).toBe(first);
  });

  it('is undefined outside a hierarchy', () => {
    const { result } = renderHook(() => useUniqueNamePaths(null));
    expect(result.current).toBeUndefined();
  });
});

describe('useLocalScene', () => {
  it('gives an outer node the outer root and its claim table', () => {
    const { result } = renderHook(() => useLocalScene('Root/Hud'), { wrapper });
    expect(result.current?.path).toBe('Root');
    expect(result.current?.uniquePaths?.get('%Hud')).toBe('Root/Hud');
  });

  it('keeps the same object across rerenders of one scene', () => {
    const view = renderHook(() => useLocalScene('Root/Hud'), { wrapper });
    const first = view.result.current;
    view.rerender();
    expect(view.result.current).toBe(first);
  });

  it('is undefined without a path', () => {
    const { result } = renderHook(() => useLocalScene(null), { wrapper });
    expect(result.current).toBeUndefined();
  });

  it('is the outer root with no claim table outside a hierarchy', () => {
    // With no scene tree there is no owner to walk to, so the outer root is all there is.
    const { result } = renderHook(() => useLocalScene('Root/Hud'));
    expect(result.current).toEqual({ path: 'Root', uniquePaths: undefined });
  });

  it('is the instance for a node inside a loaded instanced sub-scene', () => {
    const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://screen.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Monitor" parent="." instance=ExtResource("1")]
`);
    const screen = new TscnParser().parse(`[gd_scene format=3]

[node name="Screen" type="Node2D"]

[node name="SubViewport" type="SubViewport" parent="."]

[node name="Display" type="Sprite2D" parent="."]
`);
    const { loader, scenes } = createFakeResourceLoader();
    scenes.seed('res://screen.tscn', screen);
    const sceneGraph = createSceneGraphFromTscnScene(host);
    const { result } = renderHook(() => useLocalScene('Root/Monitor/Display'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
          <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
        </HierarchyProvider>
      ),
    });
    expect(result.current?.path).toBe('Root/Monitor');
  });
});

describe('useUniqueNamePaths for a node attached into an instanced GLB', () => {
  it("reads the host file's table at the path Godot gives the node", () => {
    const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://rig.glb" id="1"]

[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]
unique_name_in_owner = true

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Marker" type="Node3D" parent="Rig/Skeleton"]
unique_name_in_owner = true
`);
    const fake = createFakeResourceLoader();
    const { loader } = fake;
    const named = (name: string) => Object.assign(new THREE.Group(), { name });
    const rig = named('Scene');
    rig.add(named('Skeleton'));
    seedGlbInstance(fake, 'res://rig.glb', rig);
    const sceneGraph = createSceneGraphFromTscnScene(host);

    const { result } = renderHook(() => useUniqueNamePaths('Root/Rig/Skeleton/Marker'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
          <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
        </HierarchyProvider>
      ),
    });

    expect([result.current?.get('%Target'), result.current?.get('%Marker')]).toEqual([
      'Root/Target',
      'Root/Rig/Skeleton/Marker',
    ]);
  });
});
