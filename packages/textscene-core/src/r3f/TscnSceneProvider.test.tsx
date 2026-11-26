import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PROJECT_FILE_PATH } from '../godot/project/project';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { useResourceLoader } from '../resources/ResourceLoaderContext';
import { TscnSceneProvider } from './TscnSceneProvider';
import { TscnSceneContents } from './SceneContents';
import { useSelection, useSelectedNodePath } from './contexts/SelectionContext';
import { useHierarchy } from './contexts/HierarchyContext';
import { openScene } from '../scene/openScene';
import { resourcePipelineOf } from './sceneResourcePipeline';

// Pull in all self-registering node components
import './nodes/index';

const BOX_SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

/** A cube whose albedo is a 4 x 4 NoiseTexture2D, a texture that builds in a job, not from a file. */
const NOISE_SCENE = `[gd_scene format=3]

[sub_resource type="FastNoiseLite" id="FastNoiseLite_1"]

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_1"]
width = 4
height = 4
noise = SubResource("FastNoiseLite_1")

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_1"]
albedo_texture = SubResource("NoiseTexture2D_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("StandardMaterial3D_1")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

const emptyProvider = (): ResourceProvider => ({ loadResource: vi.fn(async () => null) });

/** A child that records each resource loader it reads. */
function loaderProbe(loaders: Set<unknown>) {
  return function LoaderProbe() {
    loaders.add(useResourceLoader());
    return null;
  };
}

describe('<TscnSceneProvider>', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets the canvas contents draw the scene it was given', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={openScene({ source: BOX_SCENE, provider: emptyProvider() })}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('reads the scene’s project settings through the given provider', async () => {
    const provider = emptyProvider();

    await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={openScene({ source: BOX_SCENE, provider: provider })}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    expect(provider.loadResource).toHaveBeenCalledWith(PROJECT_FILE_PATH, 'ProjectSettings');
  });

  it('builds a procedural texture in the main thread, since it starts no worker', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={openScene({ source: NOISE_SCENE, provider: emptyProvider() })}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
        .material as THREE.MeshStandardMaterial;
      expect(material.map?.image).toMatchObject({ width: 4, height: 4 });
    });
  });

  it('keeps one resource loader while the provider stays the same', () => {
    const provider = emptyProvider();
    const loaders = new Set<unknown>();
    const LoaderProbe = loaderProbe(loaders);
    const tree = (
      <TscnSceneProvider scene={openScene({ source: BOX_SCENE, provider: provider })}>
        <LoaderProbe />
      </TscnSceneProvider>
    );

    const { rerender } = render(tree);
    rerender(tree);

    expect(loaders.size).toBe(1);
    expect(loaders.has(null)).toBe(false);
  });

  it('gives the canvas a fresh resource loader for another provider', () => {
    const loaders = new Set<unknown>();
    const LoaderProbe = loaderProbe(loaders);
    const withProvider = (provider: ResourceProvider) => (
      <TscnSceneProvider scene={openScene({ source: BOX_SCENE, provider: provider })}>
        <LoaderProbe />
      </TscnSceneProvider>
    );

    const { rerender } = render(withProvider(emptyProvider()));
    rerender(withProvider(emptyProvider()));

    expect(loaders.size).toBe(2);
  });

  it('shares the selection with a component beside the canvas', () => {
    let selection!: ReturnType<typeof useSelection> & { selectedNodePath: string | null };
    function SelectionProbe() {
      selection = { ...useSelection(), selectedNodePath: useSelectedNodePath() };
      return null;
    }

    render(
      <TscnSceneProvider scene={openScene({ source: BOX_SCENE, provider: emptyProvider() })}>
        <SelectionProbe />
      </TscnSceneProvider>
    );
    act(() => selection.setSelectedNodePath('Cube'));

    expect(selection.selectedNodePath).toBe('Cube');
  });

  it('names the problem when the text of the scene holds no scene, since a blank canvas says nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <TscnSceneProvider
          scene={openScene({ source: '[this is { not valid tscn at all', provider: emptyProvider() })}
        >
          {null}
        </TscnSceneProvider>
      )
    ).toThrow('expected the text of a .tscn scene');
  });

  it('draws nothing for empty text, as the previewer does for an empty file', () => {
    expect(() =>
      render(
        <TscnSceneProvider scene={openScene({ source: '', provider: emptyProvider() })}>
          {null}
        </TscnSceneProvider>
      )
    ).not.toThrow();
  });

  it('clears the selection when the scene changes', () => {
    let selection!: ReturnType<typeof useSelection> & { selectedNodePath: string | null };
    function SelectionProbe() {
      selection = { ...useSelection(), selectedNodePath: useSelectedNodePath() };
      return null;
    }
    const scene = openScene({ source: BOX_SCENE, provider: emptyProvider() });
    render(
      <TscnSceneProvider scene={scene}>
        <SelectionProbe />
      </TscnSceneProvider>
    );
    act(() => selection.setSelectedNodePath('Cube'));
    act(() => scene.setSource(NOISE_SCENE));

    expect(selection.selectedNodePath).toBeNull();
  });

  describe('given a scene', () => {
    /** A child that records the scene graph and the resource loader it reads. */
    function contextProbe(seen: { graphs: Set<unknown>; loaders: Set<unknown> }) {
      return function ContextProbe() {
        seen.graphs.add(useHierarchy().sceneGraph);
        seen.loaders.add(useResourceLoader());
        return null;
      };
    }

    it('draws the parse and the resource loader of that scene', () => {
      const scene = openScene({ source: BOX_SCENE, provider: emptyProvider() });
      const seen = { graphs: new Set<unknown>(), loaders: new Set<unknown>() };
      const ContextProbe = contextProbe(seen);

      render(
        <TscnSceneProvider scene={scene}>
          <ContextProbe />
        </TscnSceneProvider>
      );

      expect([...seen.graphs]).toEqual([scene.parse().sceneGraph]);
      expect([...seen.loaders]).toEqual([resourcePipelineOf(scene).loader]);
    });

    it('gives two providers of one scene one parse and one resource loader', () => {
      const scene = openScene({ source: BOX_SCENE, provider: emptyProvider() });
      const seen = { graphs: new Set<unknown>(), loaders: new Set<unknown>() };
      const ContextProbe = contextProbe(seen);

      render(
        <>
          <TscnSceneProvider scene={scene}>
            <ContextProbe />
          </TscnSceneProvider>
          <TscnSceneProvider scene={scene}>
            <ContextProbe />
          </TscnSceneProvider>
        </>
      );

      expect(seen.graphs.size).toBe(1);
      expect(seen.loaders.size).toBe(1);
    });

    it('draws the new parse after setSource', () => {
      const scene = openScene({ source: BOX_SCENE, provider: emptyProvider() });
      const seen = { graphs: new Set<unknown>(), loaders: new Set<unknown>() };
      const ContextProbe = contextProbe(seen);
      render(
        <TscnSceneProvider scene={scene}>
          <ContextProbe />
        </TscnSceneProvider>
      );

      act(() => scene.setSource(NOISE_SCENE));

      expect([...seen.graphs].at(-1)).toBe(scene.parse().sceneGraph);
      expect(seen.loaders.size).toBe(1);
    });
  });
});
