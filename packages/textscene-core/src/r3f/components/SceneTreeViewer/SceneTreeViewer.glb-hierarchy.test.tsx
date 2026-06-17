/**
 * WI-C: a GLBSceneRoot row surfaces the loaded GLB's internal THREE.Object3D
 * hierarchy as expandable child rows, and is NOT flagged "Not implemented"
 * (it renders). Mirrors the sub-scene inlining test's loader-cache harness,
 * but stages a THREE.Object3D in the glb cache.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SceneTreeViewer } from './SceneTreeViewer';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { MetadataStore } from '../../../resources/MetadataStore';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import type { ResourceLoader } from '../../../resources/ResourceLoader';

function makeLoader(): { loader: ResourceLoader; setGlbCached: (path: string, obj: THREE.Object3D) => void } {
  const glbCache = new Map<string, THREE.Object3D | null>();
  const empty = new Map<string, unknown>();
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: () => {},
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });
  const loader = {
    eventBus: new ResourceEventBus(),
    metadata: new MetadataStore(),
    textures: makeProc(empty as Map<string, never>),
    materials: makeProc(empty as Map<string, never>),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: makeProc(empty as Map<string, never>),
    register: () => {},
    provideFile: () => {},
    clear: () => {},
  } as unknown as ResourceLoader;
  return { loader, setGlbCached: (path, obj) => glbCache.set(path, obj) };
}

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

describe('<SceneTreeViewer> WI-C — GLB internal hierarchy', () => {
  it('shows the GLB row with children and never flags it "Not implemented"', () => {
    const { loader, setGlbCached } = makeLoader();
    setGlbCached('res://player.glb', fakeGlb());

    render(<SceneTreeViewer />, { wrapper: wrap(loader, glbGraph()) });

    const row = screen.getByText('player').closest('[data-node-path]');
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('▶'); // has children → expandable
    expect(screen.queryByText(/not implemented/i)).toBeNull();
  });

});
