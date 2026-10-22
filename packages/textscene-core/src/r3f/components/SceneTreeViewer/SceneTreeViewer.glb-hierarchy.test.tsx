/**
 * A GLBSceneRoot row shows the loaded GLB's THREE.Object3D hierarchy as
 * expandable child rows, and is not flagged "Not implemented".
 */
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
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnScene } from '../../../parser/types';
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

/** The GLB scene root a `.glb` instance loads as, which the instancing node's sub-scene holds. */
const RIG_SCENE: TscnScene = {
  nodes: [
    {
      rawProperties: {},
      name: 'rig',
      type: 'GLBSceneRoot',
      children: [],
      properties: { glbPath: RIG_PATH } as Record<string, unknown>,
    },
  ],
  externalResources: [],
  internalResources: [],
};

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

  it('lists a typed node the instancing scene adds inside the GLB under the GLB row it addresses', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed(RIG_PATH, RIG_SCENE);
    fake.glbMeshes.seed(RIG_PATH, fakeGlb());
    const marker = {
      rawProperties: {},
      name: 'Marker',
      type: 'Marker3D',
      children: [],
      properties: {} as Record<string, unknown>,
      instanceSubPath: 'Armature',
    };
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        {
          rawProperties: {},
          name: 'Rig',
          type: 'Node',
          instance: 'ExtResource("rig")',
          children: [marker],
          properties: {} as Record<string, unknown>,
        },
      ],
      externalResources: [{ id: 'rig', path: RIG_PATH, type: 'PackedScene' }],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });
    for (const name of ['Rig', 'Armature']) expandRow(name);

    expect(container.querySelector('[data-node-path="Rig/Armature/Marker"]')).not.toBeNull();
    expect(container.querySelector('[data-node-path="Rig/rig"]')).toBeNull();
    expect(container.querySelector('[data-node-path="Rig/Marker"]')).toBeNull();
  });

  it('lists the GLB a sub-scene’s root instances below the node that instances the sub-scene', () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed(RIG_PATH, RIG_SCENE);
    fake.glbMeshes.seed(RIG_PATH, fakeGlb());
    fake.scenes.seed('res://wrapper.tscn', {
      nodes: [
        {
          rawProperties: {},
          name: 'WrapperRoot',
          type: 'Node',
          instance: 'ExtResource("rig")',
          children: [],
          properties: {} as Record<string, unknown>,
        },
      ],
      externalResources: [{ id: 'rig', path: RIG_PATH, type: 'PackedScene' }],
      internalResources: [],
    });
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        {
          rawProperties: {},
          name: 'Body',
          type: 'Node',
          instance: 'ExtResource("wrapper")',
          children: [],
          properties: {} as Record<string, unknown>,
        },
      ],
      externalResources: [{ id: 'wrapper', path: 'res://wrapper.tscn', type: 'PackedScene' }],
      internalResources: [],
    });

    const { container } = render(<SceneTreeViewer />, { wrapper: wrap(fake.loader, graph) });
    expandRow('Body');

    expect(container.querySelector('[data-node-path="Body/Armature"]')).not.toBeNull();
  });
});
