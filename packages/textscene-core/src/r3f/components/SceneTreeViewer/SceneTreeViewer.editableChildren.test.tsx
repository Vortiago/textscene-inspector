import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { ExpandedRowsProvider } from '../TscnPreviewShell/expandedRows';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import '../../../nodes/node/index';

const parse = (text: string) => new TscnParser().parse(`[gd_scene format=3]\n\n${text}`);

const PLAYER = parse(`[node name="PlayerRoot" type="Node3D"]

[node name="Body" type="Node3D" parent="."]
`);

const ENGINE = parse(`[node name="EngineRoot" type="Node3D"]

[node name="Nozzle" type="Node3D" parent="."]
`);

const SHIP = parse(`[ext_resource type="PackedScene" path="res://engine.tscn" id="engine"]

[node name="ShipRoot" type="Node3D"]

[node name="Engine" parent="." instance=ExtResource("engine")]
`);

function rigGlb(): THREE.Object3D {
  const armature = new THREE.Group();
  armature.name = 'Armature';
  const root = new THREE.Group();
  root.add(armature);
  return root;
}

/** Main instances player.tscn with Hat below it, ship.tscn whose Engine is engine.tscn, and rig.glb. */
function mainScene(editablePaths: readonly string[]) {
  const editables = editablePaths.map((path) => `[editable path="${path}"]`).join('\n\n');
  return parse(`[ext_resource type="PackedScene" path="res://player.tscn" id="player"]
[ext_resource type="PackedScene" path="res://ship.tscn" id="ship"]
[ext_resource type="PackedScene" path="res://rig.glb" id="rig"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Hat" type="Node3D" parent="Player"]

[node name="Ship" parent="." instance=ExtResource("ship")]

[node name="Rig" parent="." instance=ExtResource("rig")]

${editables}
`);
}

/** Renders Main's tree with every row expanded, and answers whether it lists a live path. */
function renderMain(editablePaths: readonly string[] = []) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed('res://player.tscn', PLAYER);
  fake.scenes.seed('res://engine.tscn', ENGINE);
  fake.scenes.seed('res://ship.tscn', SHIP);
  seedGlbInstance(fake, 'res://rig.glb', rigGlb());
  const graph = createSceneGraphFromTscnScene(mainScene(editablePaths));
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ExpandedRowsProvider>
            <ResourceLoaderProvider loader={fake.loader}>
              <MissingResourcesProvider>{children}</MissingResourcesProvider>
            </ResourceLoaderProvider>
          </ExpandedRowsProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  }
  const { container } = render(<SceneTreeViewer />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  return (path: string) => container.querySelector(`[data-node-path="${path}"]`) !== null;
}

describe('the scene tree lists what Godot’s Scene dock lists (scene_tree_editor.cpp:283-290)', () => {
  it('lists an instance as one row while the scene does not make its children editable', () => {
    const lists = renderMain();

    expect(lists('Main/Ship')).toBe(true);
    expect(lists('Main/Ship/Engine')).toBe(false);
    expect(lists('Main/Player/Body')).toBe(false);
  });

  it('lists the nodes the instancing scene adds below an instance', () => {
    const lists = renderMain();

    expect(lists('Main/Player/Hat')).toBe(true);
  });

  it('lists the nodes of an instance the scene makes editable', () => {
    const lists = renderMain(['Player']);

    expect(lists('Main/Player/Body')).toBe(true);
  });

  it('lists a nested instance as one row while only the outer one is editable', () => {
    const lists = renderMain(['Ship']);

    expect(lists('Main/Ship/Engine')).toBe(true);
    expect(lists('Main/Ship/Engine/Nozzle')).toBe(false);
  });

  it('lists the nodes of a nested instance the scene makes editable too', () => {
    const lists = renderMain(['Ship', 'Ship/Engine']);

    expect(lists('Main/Ship/Engine/Nozzle')).toBe(true);
  });

  it('lists an instanced GLB as one row while the scene does not make it editable', () => {
    expect(renderMain()('Main/Rig/Armature')).toBe(false);
  });

  it('lists the objects of an instanced GLB the scene makes editable', () => {
    expect(renderMain(['Rig'])('Main/Rig/Armature')).toBe(true);
  });
});
