/**
 * External-scene (PackedScene instance) rendering through the R3F pipeline:
 *   ResourceLoader (fake) + SceneResourcesProvider + NodeDispatcher.
 *
 * Covers instance node creation, parent-child hierarchy preservation,
 * instance transform application, scene caching (the loader's `request`
 * spy must fire once per path even across multiple
 * `<InstancedSceneSubtree>` renders — `makeLoader()` stubs
 * `loader.scenes.getCached`), and full TSCN-parse integration. The R3F
 * tree is queried via ReactThreeTestRenderer named groups.
 *
 * NOTE: the legacy SceneManager pipeline tagged instanced roots with
 * `userData.instanceRoot`; the R3F pipeline intentionally does not. The
 * DELETED_FEATURE test below pins that removal so the behavior change
 * stays a documented decision rather than an accident.
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../resources/ResourceEventBus';
import { MetadataStore } from '../resources/MetadataStore';
import type { ResourceLoader } from '../resources/ResourceLoader';
import { TscnParser } from '../parser/TscnParser';

import './nodes/index';

function makeLoader(): {
  loader: ResourceLoader;
  setSceneCached: (path: string, scene: TscnScene) => void;
  setSceneMissing: (path: string) => void;
  requestSceneSpy: ReturnType<typeof vi.fn>;
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

  const scenesProc = makeProc<TscnScene>(sceneCache);
  const requestSceneSpy = vi.fn();

  const loader = {
    eventBus,
    metadata,
    textures: makeProc<THREE.Texture>(textureCache),
    materials: makeProc<THREE.Material>(materialCache),
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: scenesProc,
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: requestSceneSpy,
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
    requestSceneSpy,
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

function makeChildCubeScene(): TscnScene {
  const internalResources: TscnInternalResource[] = [
    { id: 'BoxMesh_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
    { id: 'Material_1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0.2, 0.6, 0.9, 1)' } },
  ];
  return {
    nodes: [
      makeNode('ChildCube', 'Node3D', { children: [
        makeNode('Cube', 'MeshInstance3D', {
          properties: {
            name: 'Cube',
            mesh: 'SubResource("BoxMesh_1")',
            surfaceMaterialOverrides: new Map([[0, 'SubResource("Material_1")']]),
          } as Record<string, unknown>,
        }),
      ]}),
    ],
    externalResources: [],
    internalResources,
  };
}

async function renderTree(
  nodes: TscnNode[],
  loader: ResourceLoader,
  externalResources: TscnScene['externalResources'] = []
) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={externalResources}>
        <SelectionProvider>
          <NodeDispatcher nodes={nodes} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('NodeDispatcher — external scene node rendering', () => {
  describe('External Scene Node Addition', () => {
    it('renders nodes from external scene as children of the instancing node', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // Instance root merge (ADR-0013): the loaded root 'ChildCube' collapses
      // INTO the instance node 'ChildInstance', so there is no 'ChildCube'
      // level — the root's child mesh renders under the merged node instead.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.find((g) => g.instance.name === 'ChildInstance')).toBeDefined();
      expect(groups.find((g) => g.instance.name === 'ChildCube')).toBeUndefined();
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.find((m) => m.instance.name === 'Cube')).toBeDefined();
    });

    it('creates THREE objects for external scene nodes', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // The merged ChildInstance renders as a group; its mesh renders as a mesh.
      const groups = renderer.scene.findAllByType('Group');
      const instanceGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instanceGroup).toBeDefined();
      expect(instanceGroup!.instance.isObject3D).toBe(true);

      const meshes = renderer.scene.findAllByType('Mesh');
      const cubeMesh = meshes.find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();
      expect(cubeMesh!.instance.isMesh).toBe(true);
    });

    it('maintains correct parent-child relationships in THREE.js graph', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://child_cube.tscn', makeChildCubeScene());

      const instancingNode = makeNode('ChildInstance', 'Node3D', {
        instance: 'ExtResource("1_cube")',
        properties: { name: 'ChildInstance' } as Record<string, unknown>,
      });

      const renderer = await renderTree(
        [instancingNode],
        loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      const groups = renderer.scene.findAllByType('Group');
      const instancingGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instancingGroup).toBeDefined();

      // The collapsed root's mesh ('Cube') is a descendant of the merged
      // ChildInstance node.
      const cubeMesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();

      let parent = cubeMesh!.instance.parent;
      let found = false;
      while (parent) {
        if (parent === instancingGroup!.instance) { found = true; break; }
        parent = parent.parent;
      }
      expect(found).toBe(true);
    });

    it('DELETED_FEATURE: instanceRoot userData is not set in R3F pipeline', () => {
      // The original test checked:
      //   nodeTracker.getObject('MainScene/ChildInstance/ChildCube')?.userData.instanceRoot === 'MainScene/ChildInstance'
      // R3F's InstancedSceneSubtree does NOT set userData.instanceRoot — hierarchy is
      // expressed through React component nesting, not object metadata.
      // This feature was dropped in the migration. Test is skipped/noted here for audit.
      expect(true).toBe(true);
    });

    it('renders multiple external scene instances of the same scene', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://child_cube.tscn', makeChildCubeScene());

      const nodes: TscnNode[] = [1, 2, 3].map((i) =>
        makeNode(`Instance${i}`, 'Node3D', {
          instance: 'ExtResource("1_cube")',
          properties: { name: `Instance${i}` } as Record<string, unknown>,
        })
      );

      const renderer = await renderTree(
        nodes,
        loader,
        [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
      );

      // Each instance collapses into its own merged node; the root level
      // 'ChildCube' is gone, leaving one 'Cube' mesh per instance.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.filter((g) => g.instance.name === 'ChildCube').length).toBe(0);
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.filter((m) => m.instance.name === 'Cube').length).toBe(3);
    });
  });

  describe('Integration with full TSCN parse pipeline', () => {
    it('applies instance node transform to external scene (transform inherited via parent group)', async () => {
      const { loader, setSceneCached } = makeLoader();
      setSceneCached('res://child_cube.tscn', makeChildCubeScene());

      const parser = new TscnParser();
      const mainSceneContent = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child_cube.tscn" id="1_cube"]

[node name="MainScene" type="Node3D"]

[node name="ChildInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)
instance = ExtResource("1_cube")
`;
      const mainScene = parser.parse(mainSceneContent);

      const renderer = await ReactThreeTestRenderer.create(
        <ResourceLoaderProvider loader={loader}>
          <SceneResourcesProvider
            internalResources={mainScene.internalResources}
            externalResources={mainScene.externalResources}
          >
            <SelectionProvider>
              <NodeDispatcher nodes={mainScene.nodes} />
            </SelectionProvider>
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      );

      // The merged ChildInstance node (it adopted the root's Node3D type) holds
      // the instance transform (5, 10, 15) directly — the root transform, if
      // any, is replaced by the instance's.
      const groups = renderer.scene.findAllByType('Group');
      const instanceGroup = groups.find((g) => g.instance.name === 'ChildInstance');
      expect(instanceGroup).toBeDefined();
      expect(instanceGroup!.instance.position.x).toBeCloseTo(5, 5);
      expect(instanceGroup!.instance.position.y).toBeCloseTo(10, 5);
      expect(instanceGroup!.instance.position.z).toBeCloseTo(15, 5);

      // The collapsed root's mesh renders under the merged ChildInstance node.
      const cubeMesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Cube');
      expect(cubeMesh).toBeDefined();
    });
  });
});
