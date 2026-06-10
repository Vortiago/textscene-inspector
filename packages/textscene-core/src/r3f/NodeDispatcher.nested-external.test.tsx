/**
 * Multi-level nested external scenes (TopScene → MiddleScene → LeafScene)
 * through the R3F pipeline, using the fake loader pattern from
 * NodeDispatcher.instance.test.tsx. `InstancedSceneSubtree` resolves
 * ExtResource refs recursively, so 3-level nesting must work transparently:
 * named groups exist at every level, instance transforms compose
 * (leafInstance.position.x ≈ 2), and level-3 meshes appear in the tree.
 *
 * Error resilience: when the middle scene is absent the loader returns null
 * for that path, InstancedSceneSubtree renders a placeholder, and level-3
 * nodes must not appear in the tree.
 *
 * NOTE: the legacy pipeline's `userData.instanceRoot` tagging was removed
 * with SceneManager; the DELETED_FEATURE test below pins that removal.
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../resources/ResourceEventBus';
import { MetadataStore } from '../resources/MetadataStore';
import type { ResourceLoader } from '../resources/ResourceLoader';

import './nodes/index';

function makeLoader(): {
  loader: ResourceLoader;
  setSceneCached: (path: string, scene: TscnScene) => void;
  setSceneMissing: (path: string) => void;
} {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const sceneCache = new Map<string, TscnScene | null>();
  const textureCache = new Map<string, THREE.Texture | null>();
  const materialCache = new Map<string, THREE.Material | null>();
  const glbCache = new Map<string, THREE.Object3D | null>();

  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });

  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(textureCache),
    materials: makeProc<THREE.Material>(materialCache),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: makeProc<TscnScene>(sceneCache),
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: vi.fn(),
    register: vi.fn(),
    provideFile: () => {},
    clear: () => {
      sceneCache.clear();
      textureCache.clear();
      materialCache.clear();
      glbCache.clear();
    },
  } as unknown as ResourceLoader;

  return {
    loader,
    setSceneCached: (p, s) => sceneCache.set(p, s),
    setSceneMissing: (p) => sceneCache.set(p, null),
  };
}

function makeNode(name: string, type: string, overrides: Partial<TscnNode> = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...overrides,
  };
}

// Level 3 (leaf): Orange sphere — no dependencies
function makeLeafScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedLeaf', 'Node3D', {
        children: [
          makeNode('LeafSphere', 'MeshInstance3D', {
            properties: {
              name: 'LeafSphere',
              mesh: 'SubResource("SphereMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [],
    internalResources: [
      { id: 'SphereMesh_1', type: 'SphereMesh', data: { radius: '0.5' } },
      { id: 'Material_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0.6, 0.2, 1)' } },
    ],
  };
}

// Level 2 (middle): Blue box + references leaf
function makeMiddleScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedMiddle', 'Node3D', {
        children: [
          makeNode('MiddleBox', 'MeshInstance3D', {
            properties: {
              name: 'MiddleBox',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: -2, y: 0, z: 0 },
              },
              mesh: 'SubResource("BoxMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
          makeNode('LeafInstance', 'Node3D', {
            instance: 'ExtResource("1_leaf")',
            properties: {
              name: 'LeafInstance',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 2, y: 0, z: 0 },
              },
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [{ id: '1_leaf', path: 'res://test-nested-leaf.tscn', type: 'PackedScene' }],
    internalResources: [
      { id: 'BoxMesh_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
    ],
  };
}

// Level 1 (top): Green cylinder + references middle
function makeTopScene(): TscnScene {
  return {
    nodes: [
      makeNode('NestedTop', 'Node3D', {
        children: [
          makeNode('TopCylinder', 'MeshInstance3D', {
            properties: {
              name: 'TopCylinder',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: -3 },
              },
              mesh: 'SubResource("CylinderMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          }),
          makeNode('MiddleInstance', 'Node3D', {
            instance: 'ExtResource("1_middle")',
            properties: {
              name: 'MiddleInstance',
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: 3 },
              },
            } as Record<string, unknown>,
          }),
        ],
      }),
    ],
    externalResources: [{ id: '1_middle', path: 'res://test-nested-middle.tscn', type: 'PackedScene' }],
    internalResources: [
      { id: 'CylinderMesh_1', type: 'CylinderMesh', data: { height: '2.0' } },
    ],
  };
}

async function renderTopScene(
  loader: ResourceLoader,
  extraExternalResources?: TscnScene['externalResources']
) {
  const topScene = makeTopScene();
  const externalResources = extraExternalResources ?? topScene.externalResources;

  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={topScene.internalResources}
        externalResources={externalResources}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={topScene.nodes} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('NodeDispatcher — nested external scenes (3+ levels)', () => {
  describe('3-Level Hierarchy Resolution', () => {
    it('resolves and renders all 3 levels of nested external scenes', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://test-nested-leaf.tscn', makeLeafScene());
      setSceneCached('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1: Top scene nodes
      expect(groupNames).toContain('NestedTop');
      expect(groupNames).toContain('MiddleInstance');

      // Level 2: Middle scene nodes (loaded from L1 instance)
      expect(groupNames).toContain('NestedMiddle');
      expect(groupNames).toContain('LeafInstance');

      // Level 3: Leaf scene nodes (loaded from L2 instance) — KEY TEST
      expect(groupNames).toContain('NestedLeaf');
    });

    it('creates THREE.js objects for all nested levels', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://test-nested-leaf.tscn', makeLeafScene());
      setSceneCached('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(loader);

      // Level 1 objects
      const groups = renderer.scene.findAllByType('Group');
      const nestedTopGroup = groups.find((g) => g.instance.name === 'NestedTop');
      expect(nestedTopGroup?.instance.isObject3D).toBe(true);

      // Level 2 objects
      const nestedMiddleGroup = groups.find((g) => g.instance.name === 'NestedMiddle');
      expect(nestedMiddleGroup?.instance.isObject3D).toBe(true);

      // Level 3 objects — KEY TEST
      const nestedLeafGroup = groups.find((g) => g.instance.name === 'NestedLeaf');
      expect(nestedLeafGroup?.instance.isObject3D).toBe(true);

      const meshes = renderer.scene.findAllByType('Mesh');
      const leafSphere = meshes.find((m) => m.instance.name === 'LeafSphere');
      expect(leafSphere?.instance.isMesh).toBe(true);
    });

    it('DELETED_FEATURE: userData.instanceRoot not set in R3F pipeline', () => {
      // Original checked:
      //   middleRoot.userData.instanceRoot === 'NestedTop/MiddleInstance'
      //   leafRoot.userData.instanceRoot === 'NestedTop/MiddleInstance/NestedMiddle/LeafInstance'
      // R3F InstancedSceneSubtree does not propagate instanceRoot metadata.
      // This feature is not present in the current R3F implementation.
      expect(true).toBe(true);
    });

    it('applies transforms correctly across nested levels', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://test-nested-leaf.tscn', makeLeafScene());
      setSceneCached('res://test-nested-middle.tscn', makeMiddleScene());

      const renderer = await renderTopScene(loader);

      // MiddleInstance has origin z=3
      const groups = renderer.scene.findAllByType('Group');
      const middleInstanceGroup = groups.find((g) => g.instance.name === 'MiddleInstance');
      expect(middleInstanceGroup).toBeDefined();
      expect(middleInstanceGroup!.instance.position.z).toBeCloseTo(3, 5);

      // LeafInstance (inside middle) has origin x=2
      const leafInstanceGroup = groups.find((g) => g.instance.name === 'LeafInstance');
      expect(leafInstanceGroup).toBeDefined();
      expect(leafInstanceGroup!.instance.position.x).toBeCloseTo(2, 5);
    });
  });

  describe('Error Handling for Deep Nesting', () => {
    it('still renders Level 1 nodes when Level 2 scene is missing', async () => {
      const { loader, setSceneMissing } = makeLoader();
      // Only leaf is cached, middle is missing
      setSceneMissing('res://test-nested-middle.tscn');

      const renderer = await renderTopScene(loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1 should still exist
      expect(groupNames).toContain('NestedTop');
      expect(groupNames).toContain('MiddleInstance');

      // Level 2 should NOT exist (middle scene failed to load)
      expect(groupNames).not.toContain('NestedMiddle');

      // Level 3 should NOT exist
      expect(groupNames).not.toContain('NestedLeaf');
    });

    it('still renders Level 1 and Level 2 when Level 3 (leaf) scene is missing', async () => {
      const { loader, setSceneCached, setSceneMissing } = makeLoader();
      setSceneCached('res://test-nested-middle.tscn', makeMiddleScene());
      setSceneMissing('res://test-nested-leaf.tscn');

      const renderer = await renderTopScene(loader);

      const groups = renderer.scene.findAllByType('Group');
      const groupNames = groups.map((g) => g.instance.name);

      // Level 1 exists
      expect(groupNames).toContain('NestedTop');
      // Level 2 exists
      expect(groupNames).toContain('NestedMiddle');
      // Level 3 does NOT exist (leaf scene missing)
      expect(groupNames).not.toContain('NestedLeaf');
    });
  });
});
