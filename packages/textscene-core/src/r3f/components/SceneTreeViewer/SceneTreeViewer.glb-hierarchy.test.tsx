/**
 * A GLBSceneRoot row shows the loaded GLB's THREE.Object3D hierarchy as
 * expandable child rows, and is not flagged "Not implemented".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { initGlbModules } from '../../../resources/processing/glbProcessing';

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

// `cloneWithMaterials` needs the lazy GLB module cache initialised first.
beforeAll(async () => {
  await initGlbModules();
});

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

});
