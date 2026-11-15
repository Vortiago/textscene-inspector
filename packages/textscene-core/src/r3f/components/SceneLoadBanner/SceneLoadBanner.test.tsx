import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneLoadBanner } from './SceneLoadBanner';

const MAIN = `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://atlas.tres" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`;

function mount() {
  const fake = createFakeResourceLoader();
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(MAIN), 'res://main.tscn');
  render(
    <ResourceLoaderProvider loader={fake.loader}>
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SceneLoadBanner />
      </HierarchyProvider>
    </ResourceLoaderProvider>
  );
  return fake;
}

describe('<SceneLoadBanner>', () => {
  it('says the game would fail to load the scene, with Godot line and the chain', () => {
    const fake = mount();

    act(() =>
      fake.loadOutcomes._resolve('res://atlas.tres', {
        isFailed: true,
        chain: ['res://atlas.tres', 'res://gone.png'],
        cause: 'missing',
      })
    );

    expect(screen.getByRole('alert').textContent).toBe(
      [
        'The game would fail to load this scene',
        'res://main.tscn: [ext_resource] referenced non-existent resource at: res://atlas.tres',
        'res://main.tscn → res://atlas.tres → res://gone.png (missing)',
      ].join('')
    );
  });

  it('shows nothing while each file the scene reads loads', () => {
    const fake = mount();

    act(() => fake.loadOutcomes._resolve('res://atlas.tres', { isFailed: false }));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
