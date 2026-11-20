import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import '../../../nodes/node/index';

function named<T extends THREE.Object3D>(o: T, name: string): T {
  o.name = name;
  return o;
}

/** A small GLB scene root: body (Mesh), spine (Bone), Armature (Group → hand). */
function fakeGlb(): THREE.Object3D {
  const root = new THREE.Group();
  const armature = named(new THREE.Group(), 'Armature');
  armature.add(named(new THREE.Mesh(), 'hand'));
  root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Bone(), 'spine'), armature);
  return root;
}

function wrap(loader: ResourceLoader, graph: ReturnType<typeof createSceneGraphFromTscnScene>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ResourceLoaderProvider loader={loader}>
            <MissingResourcesProvider>{children}</MissingResourcesProvider>
          </ResourceLoaderProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
  };
}

function glbGraph() {
  return createSceneGraphFromTscnScene({
    nodes: [
      {
        rawProperties: {},
        name: 'player',
        type: 'GLBSceneRoot',
        children: [],
        properties: { glbPath: 'res://player.glb' } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  });
}

const RIG_PATH = 'res://rig.glb';

const parse = (text: string) => new TscnParser().parse(`[gd_scene format=3]\n\n${text}`);

function expandRow(name: string) {
  const row = screen.getByText(name).closest('[data-node-path]') as HTMLElement;
  act(() => fireEvent.click(within(row).getAllByRole('button', { name: /expand/i })[0]!));
}

describe('<SceneTreeViewer> WI-C — GLB internal hierarchy', () => {
  it('shows the GLB row with children and never flags it "Not implemented"', () => {
    const fake = createFakeResourceLoader();
    fake.glbMeshes.seed('res://player.glb', fakeGlb());

    render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, glbGraph()) });

    const row = screen.getByText('player').closest('[data-node-path]');
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('▶'); // It has children, so it expands.
    expect(screen.queryByText(/not implemented/i)).toBeNull();
  });

  it('lists a typed node the inheriting scene adds inside the GLB under the GLB row it addresses', () => {
    const fake = createFakeResourceLoader();
    seedGlbInstance(fake, RIG_PATH, fakeGlb());
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="${RIG_PATH}" id="rig"]

[node name="Rig" instance=ExtResource("rig")]

[node name="Marker" type="Marker3D" parent="Armature"]
`)
    );

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });
    for (const name of ['Rig', 'Armature']) expandRow(name);

    expect(container.querySelector('[data-node-path="Rig/Armature/Marker"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Rig/rig"]')).toBeNull();
    expect(container.querySelector('[data-node-path="Rig/Marker"]')).toBeNull();
  });

  it('lists the GLB a sub-scene’s root instances below the node that instances the sub-scene', () => {
    const fake = createFakeResourceLoader();
    seedGlbInstance(fake, RIG_PATH, fakeGlb());
    fake.scenes.seed(
      'res://wrapper.tscn',
      parse(`[ext_resource type="PackedScene" path="${RIG_PATH}" id="rig"]

[node name="WrapperRoot" instance=ExtResource("rig")]
`)
    );
    const graph = createSceneGraphFromTscnScene(
      parse(`[ext_resource type="PackedScene" path="res://wrapper.tscn" id="wrapper"]

[node name="Body" instance=ExtResource("wrapper")]
`)
    );

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });
    expandRow('Body');

    expect(container.querySelector('[data-node-path="Body/Armature"]')).not.toBeNull();
  });
});
