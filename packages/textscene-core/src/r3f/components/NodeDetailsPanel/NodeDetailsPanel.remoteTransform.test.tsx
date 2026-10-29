/**
 * The inspector shows the transform a RemoteTransform pushes onto the node it names, also for a
 * node inside an instanced PackedScene.
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
import '../../../nodes/2d/polygon2d/index';
import '../../../nodes/2d/remotetransform2d/index';

const HOLDER = `[gd_scene format=3]
[node name="Holder" type="Node2D"]
[node name="Target" type="Polygon2D" parent="."]
[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 200)
remote_path = NodePath("../Target")
`;

const HOST = `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="res://holder.tscn" id="1_holder"]
[node name="Root" type="Node2D"]
[node name="Inst" parent="." instance=ExtResource("1_holder")]
`;

function Selector({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  return (
    <button data-testid="select-node" onClick={() => setSelectedNodePath(path)}>
      select
    </button>
  );
}

function renderPanelOver(targetPath: string) {
  const { loader, scenes } = createFakeResourceLoader();
  scenes.seed('res://holder.tscn', new TscnParser().parse(HOLDER));
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(HOST));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
  return render(
    <>
      <NodeDetailsPanel />
      <Selector path={targetPath} />
    </>,
    { wrapper }
  );
}

describe('<NodeDetailsPanel> over a RemoteTransform target', () => {
  it('shows the position the relay pushed onto a node inside an instance', async () => {
    renderPanelOver('Root/Inst/Target');

    await act(async () => {
      screen.getByTestId('select-node').click();
    });

    expect(screen.getByText(/300/)).toBeTruthy();
    expect(screen.getByText(/200/)).toBeTruthy();
  });
});
