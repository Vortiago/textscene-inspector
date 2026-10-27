/**
 * The inspector resolves a node whose heading walked into an instance and was seated outside it,
 * at the path the live tree shows (`useLiveNode`), and re-derives when the instance's scene lands.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import '../../../nodes/node/index';
import '../../../nodes/base/node3d/index';

const HUD = new TscnParser().parse(`[gd_scene format=3]

[node name="Hud" type="Node3D"]
`);

const HOST = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://hud.tscn" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]
`);

const SHADE_PATH = 'Main/Lamp/Shade';

function Selector() {
  const { setSelectedNodePath } = useSelection();
  return <button data-testid="select" onClick={() => setSelectedNodePath(SHADE_PATH)} />;
}

function wrap(loader: ResourceLoader) {
  const graph = createSceneGraphFromTscnScene(HOST);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  };
}

describe('<NodeDetailsPanel> a node seated outside the instance its heading walked into', () => {
  it('resolves the node at its new path', async () => {
    const { loader, scenes } = createFakeResourceLoader();
    scenes.seed('res://hud.tscn', HUD);

    render(
      <>
        <NodeDetailsPanel />
        <Selector />
      </>,
      { wrapper: wrap(loader) }
    );
    await act(async () => {
      screen.getByTestId('select').click();
    });

    expect(screen.getByRole('heading', { name: 'Shade' })).toBeTruthy();
    expect(screen.getByText(SHADE_PATH)).toBeTruthy();
  });
});
