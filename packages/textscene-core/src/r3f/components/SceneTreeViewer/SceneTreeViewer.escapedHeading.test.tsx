/**
 * A host heading whose `parent=` walk leaves the instance it enters is a row of the node where the
 * walk ends, not of the instance (packed_scene.cpp:157-165).
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, within } from '@testing-library/react';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';

const HUD_PATH = 'res://hud.tscn';

const HUD = new TscnParser().parse(`[gd_scene format=3]

[node name="Hud" type="Node3D"]

[node name="Box" type="Node3D" parent="."]
`);

const HOST_PATH = 'res://main1.tscn';

/** HudInstance's table holds `%Lamp` for a node outside the instance, so Shade leaves it. */
const HOST = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="${HUD_PATH}" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]
`);

/** A file that instances the host as `Stage`, so the heading that leaves HudInstance sits in a sub-scene. */
const OUTER = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="${HOST_PATH}" id="main1"]

[node name="Outer" type="Node3D"]

[node name="Stage" parent="." instance=ExtResource("main1")]
`);

function renderTree(file = HOST) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(HUD_PATH, HUD);
  fake.scenes.seed(HOST_PATH, HOST);
  return render(
    <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(file), panelId: 'p' }}>
      <SelectionProvider>
        <ResourceLoaderProvider loader={fake.loader}>
          <MissingResourcesProvider>
            <SceneTreeViewer />
          </MissingResourcesProvider>
        </ResourceLoaderProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/** The row of the node at `path`, once the rows above it are expanded. */
function rowAt(container: HTMLElement, path: string): HTMLElement {
  const row = container.querySelector<HTMLElement>(`[data-node-path="${path}"]`);
  if (!row) throw new Error(`expected a row for ${path}, found none`);
  return row;
}

function expand(container: HTMLElement, path: string): void {
  act(() => fireEvent.click(within(rowAt(container, path)).getAllByRole('button', { name: 'Expand' })[0]!));
}

describe('<SceneTreeViewer> over a heading that leaves its instance', () => {
  it('lists the heading under the node where its walk ends', () => {
    const { container } = renderTree();
    expand(container, 'Main');

    expand(container, 'Main/Lamp');

    expect(rowAt(container, 'Main/Lamp/Shade')).toBeTruthy();
  });

  it('does not list the heading under the instance', () => {
    const { container } = renderTree();
    expand(container, 'Main');

    expand(container, 'Main/HudInstance');

    expect(container.querySelector('[data-node-path="Main/HudInstance/Shade"]')).toBeNull();
    expect(rowAt(container, 'Main/HudInstance/Box')).toBeTruthy();
  });
});

describe('<SceneTreeViewer> over a heading that leaves an instance of an instanced file', () => {
  it('lists the heading under the node where its walk ends, inside the instanced file', () => {
    const { container } = renderTree(OUTER);
    expand(container, 'Outer');
    expand(container, 'Outer/Stage');
    expand(container, 'Outer/Stage/HudInstance');

    expand(container, 'Outer/Stage/Lamp');

    expect(rowAt(container, 'Outer/Stage/Lamp/Shade')).toBeTruthy();
  });
});
