/**
 * Godot adds a scene tile instance to its layer with no owner (`tile_map_layer.cpp:1646`), so the
 * Scene dock lists no row for it. The panel follows the dock.
 */
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import { parseTresFile } from '../../../parser/parsedResource';
import '../../nodes/index';

const CRATE = `[gd_scene format=3]

[node name="Crate" type="Node2D"]
`;

const TILE_SET = `[gd_resource type="TileSet" format=3]

[ext_resource type="PackedScene" path="res://crate.tscn" id="crate"]

[sub_resource type="TileSetScenesCollectionSource" id="scenes"]
scenes/1/scene = ExtResource("crate")

[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("scenes")
`;

/** One layer with a crate scene tile at cell (0, 0) and no authored child. */
const LEVEL = `[gd_scene format=3]

[ext_resource type="TileSet" path="res://tiles.tres" id="ts"]

[node name="Level" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_map_data = PackedByteArray(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0)
tile_set = ExtResource("ts")
`;

describe('<SceneTreeViewer> scene tiles', () => {
  it('lists no row for the scene tile instances of a layer', async () => {
    const parser = new TscnParser();
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://crate.tscn', parser.parse(CRATE));
    fake.resources.seed('res://tiles.tres', parseTresFile(TILE_SET));
    const sceneGraph = createSceneGraphFromTscnScene(parser.parse(LEVEL));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={fake.loader}>
            <MissingResourcesProvider>{children}</MissingResourcesProvider>
          </ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );

    render(<SceneTreeViewer />, { wrapper });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Expand' }));
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve));
    });

    expect(screen.getByText('Layer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
  });
});
