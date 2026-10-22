/**
 * `<TscnSceneProvider>` gives `<TscnCanvas>` what the preview shell's providers give it, from the
 * text of a scene and a `ResourceProvider`, with none of the previewer's UI around it.
 */

import { useContext } from 'react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PROJECT_FILE_PATH } from '../godot/project/project';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { ResourceLoaderContext } from '../resources/ResourceLoaderContext';
import { TscnSceneProvider } from './TscnSceneProvider';
import { TscnSceneContents } from './TscnCanvas';
import { useSelection } from './contexts/SelectionContext';

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
    loaders.add(useContext(ResourceLoaderContext));
    return null;
  };
}

describe('<TscnSceneProvider>', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets the canvas contents draw the scene it was given', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider source={BOX_SCENE} provider={emptyProvider()}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('reads the scene’s project settings through the given provider', async () => {
    const provider = emptyProvider();

    await ReactThreeTestRenderer.create(
      <TscnSceneProvider source={BOX_SCENE} provider={provider}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    expect(provider.loadResource).toHaveBeenCalledWith(PROJECT_FILE_PATH, 'ProjectSettings');
  });

  it('builds a procedural texture in the main thread, since it starts no worker', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider source={NOISE_SCENE} provider={emptyProvider()}>
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
      <TscnSceneProvider source={BOX_SCENE} provider={provider}>
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
      <TscnSceneProvider source={BOX_SCENE} provider={provider}>
        <LoaderProbe />
      </TscnSceneProvider>
    );

    const { rerender } = render(withProvider(emptyProvider()));
    rerender(withProvider(emptyProvider()));

    expect(loaders.size).toBe(2);
  });

  it('shares the selection with a component beside the canvas', () => {
    let selection!: ReturnType<typeof useSelection>;
    function SelectionProbe() {
      selection = useSelection();
      return null;
    }

    render(
      <TscnSceneProvider source={BOX_SCENE} provider={emptyProvider()}>
        <SelectionProbe />
      </TscnSceneProvider>
    );
    act(() => selection.setSelectedNodePath('Cube'));

    expect(selection.selectedNodePath).toBe('Cube');
  });

  it('names the problem when the text holds no scene, since a blank canvas says nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <TscnSceneProvider source="[this is { not valid tscn at all" provider={emptyProvider()}>
          {null}
        </TscnSceneProvider>
      )
    ).toThrow('expected the text of a .tscn scene');
  });

  it('draws nothing for empty text, as the previewer does for an empty file', () => {
    expect(() =>
      render(
        <TscnSceneProvider source="" provider={emptyProvider()}>
          {null}
        </TscnSceneProvider>
      )
    ).not.toThrow();
  });

  it('clears the selection when the scene changes', () => {
    let selection!: ReturnType<typeof useSelection>;
    function SelectionProbe() {
      selection = useSelection();
      return null;
    }
    const provider = emptyProvider();
    const withScene = (source: string) => (
      <TscnSceneProvider source={source} provider={provider}>
        <SelectionProbe />
      </TscnSceneProvider>
    );

    const { rerender } = render(withScene(BOX_SCENE));
    act(() => selection.setSelectedNodePath('Cube'));
    rerender(withScene(NOISE_SCENE));

    expect(selection.selectedNodePath).toBeNull();
  });
});
