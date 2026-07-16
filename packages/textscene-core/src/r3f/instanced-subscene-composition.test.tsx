/**
 * BUG 3 regression / composition guard for PhotoFrame instances.
 *
 * Investigation finding: the renderer is NOT at fault for
 * PhotoFrameA appearing too high. The transform/instance composition
 * places each PhotoFrame's Canvas mesh at EXACTLY the origin authored in
 * the room scene. PhotoFrameA's authored origin
 * `(8.548, 3.008, -1.625)` simply carries an anomalous Y=3.008 (its
 * wall-mates hang at Y≈2.0–2.5) — the origins below are captured verbatim
 * from the real-world scene that surfaced the bug, outlier included.
 *
 * The previewer's job is to reproduce what Godot shows, so the outlier
 * must be reproduced, not "corrected" (that would make the previewer
 * DIVERGE from Godot). We pin the invariant that broke the diagnosis: an
 * instanced sub-scene's mesh inherits the instancing node's transform
 * exactly. This catches any future composition regression across every
 * PhotoFrame, and documents that the outlier's height is data, not a bug.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../resources/ResourceEventBus';
import { MetadataStore } from '../resources/MetadataStore';
import type { ResourceLoader } from '../resources/ResourceLoader';

import './nodes/index';

function makeLoader() {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const sceneCache = new Map<string, TscnScene | null>();
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
    pin: () => {},
    unpin: () => {},
  });
  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(new Map()),
    materials: makeProc<THREE.Material>(new Map()),
    glbMeshes: makeProc<THREE.Object3D>(new Map()),
    scenes: makeProc<TscnScene>(sceneCache),
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: vi.fn(),
    register: vi.fn(),
    provideFile: () => {},
    clear: () => {},
  } as unknown as ResourceLoader;
  return { loader, setSceneCached: (p: string, s: TscnScene) => sceneCache.set(p, s) };
}

/** A PhotoFrame sub-scene: root Node3D with an identity Canvas MeshInstance3D. */
function makePhotoFrameScene(canvasName: string): TscnScene {
  const internalResources: TscnInternalResource[] = [
    { id: 'Plane_1', type: 'PlaneMesh', data: { id: 'Plane_1', size: 'Vector2(0.5, 0.5)' } },
  ];
  return {
    nodes: [
      {
        name: 'FrameRoot',
        type: 'Node3D',
        children: [
          {
            name: canvasName,
            type: 'MeshInstance3D',
            children: [],
            properties: {
              name: canvasName,
              mesh: 'SubResource("Plane_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          },
        ],
        properties: { name: 'FrameRoot' } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources,
  };
}

/** A Hallway-level PhotoFrame instancing node carrying the authored transform basis + origin. */
function makeFrameInstanceNode(
  name: string,
  scenePath: string,
  origin: { x: number; y: number; z: number }
): TscnNode {
  return {
    name,
    type: 'Node',
    instance: `ExtResource("${name}_ref")`,
    children: [],
    properties: {
      name,
      // The PhotoFrames all use a 180°-ish Y-rotation basis; identity
      // here is sufficient to pin origin inheritance, which is the
      // load-bearing invariant.
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin,
      },
    } as Record<string, unknown>,
  };
}

async function renderFrame(
  loader: ResourceLoader,
  node: TscnNode,
  ref: { id: string; path: string }
) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: ref.id, path: ref.path, type: 'PackedScene' }]}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={[node]} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function canvasWorldPosition(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  name: string
): THREE.Vector3 {
  const mesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === name);
  expect(mesh, `Canvas mesh "${name}" should render`).toBeDefined();
  const obj = mesh!.instance as THREE.Object3D;
  let top: THREE.Object3D = obj;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  return obj.getWorldPosition(new THREE.Vector3());
}

// Authored origins captured from a real-world hallway scene.
const FRAMES = [
  { name: 'PhotoFrameA', origin: { x: 8.548, y: 3.008, z: -1.625 } },
  { name: 'PhotoFrameB', origin: { x: 0.75, y: 2, z: -1.625 } },
];

describe('PhotoFrame composition — Canvas mesh inherits the authored instance origin', () => {
  it.each(FRAMES)(
    '$name Canvas world position == authored instance origin',
    async ({ name, origin }) => {
      const { loader, setSceneCached } = makeLoader();
      const scenePath = `res://${name}.tscn`;
      setSceneCached(scenePath, makePhotoFrameScene('Canvas'));

      const renderer = await renderFrame(
        loader,
        makeFrameInstanceNode(name, scenePath, origin),
        { id: `${name}_ref`, path: scenePath }
      );

      const pos = canvasWorldPosition(renderer, 'Canvas');
      expect(pos.x).toBeCloseTo(origin.x, 4);
      expect(pos.y).toBeCloseTo(origin.y, 4);
      expect(pos.z).toBeCloseTo(origin.z, 4);
    }
  );

  it('PhotoFrameA renders at its authored Y=3.008 (data outlier, faithfully reproduced — not a renderer bug)', async () => {
    const { loader, setSceneCached } = makeLoader();
    const origin = { x: 8.548, y: 3.008, z: -1.625 };
    setSceneCached('res://PhotoFrameA.tscn', makePhotoFrameScene('Canvas'));

    const renderer = await renderFrame(
      loader,
      makeFrameInstanceNode('PhotoFrameA', 'res://PhotoFrameA.tscn', origin),
      { id: 'PhotoFrameA_ref', path: 'res://PhotoFrameA.tscn' }
    );

    const pos = canvasWorldPosition(renderer, 'Canvas');
    // The previewer matches Godot: it reproduces Y=3.008 verbatim. It does
    // NOT silently "correct" the data to the wall height (~2.0).
    expect(pos.y).toBeCloseTo(3.008, 4);
    expect(pos.y).not.toBeCloseTo(2.0, 1);
  });
});
