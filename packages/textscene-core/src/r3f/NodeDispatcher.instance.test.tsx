/**
 * Tests for WI-R3F-12: PackedScene instance rendering.
 *
 * `<NodeDispatcher>` walks a TSCN scene; nodes with `instance =
 * ExtResource("scene_id")` need to load the referenced external scene
 * and render its nodes as additional children, inheriting the
 * instancing node's transform. These tests pin:
 *   1. Happy path — loaded scene's nodes appear as children of the
 *      instancing Node3D, with the instance's transform applied.
 *   2. Missing path — magenta placeholder + label when the referenced
 *      scene isn't available; no crash.
 *   3. Nested instancing — A instances B instances C; all three levels
 *      render.
 *   4. Multiple instances — one PackedScene referenced from multiple
 *      instancing nodes, each at its own position.
 *   5. Inline children + instance children co-exist on the same node.
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

// All node-type components self-register on import. Pull in the barrel
// so MeshInstance3D / Node3D / etc. dispatch through to their components.
import './nodes/index';

/**
 * Make a fake ResourceLoader whose `requestScene` / `getSceneCached`
 * surface return pre-staged TscnScene objects synchronously. Mirrors
 * the `makeLoader` pattern from the texture tests — the production
 * SceneLoader pipeline (fetch + parse) is async and brittle to stub
 * end-to-end; this lets the dispatcher exercise the happy and missing
 * paths deterministically.
 */
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

function makeNode(
  name: string,
  type: string,
  overrides: Partial<TscnNode> = {}
): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...overrides,
  };
}

function makeBoxScene(meshName = 'TheBox'): TscnScene {
  const internalResources: TscnInternalResource[] = [
    {
      id: 'Box_1',
      type: 'BoxMesh',
      data: { id: 'Box_1', size: 'Vector3(1, 1, 1)' },
    },
  ];
  return {
    nodes: [
      makeNode(meshName, 'MeshInstance3D', {
        properties: {
          name: meshName,
          mesh: 'SubResource("Box_1")',
          surfaceMaterialOverrides: new Map(),
        } as Record<string, unknown>,
      }),
    ],
    externalResources: [],
    internalResources,
  };
}

async function renderTree(
  nodes: TscnNode[],
  loader: ResourceLoader,
  externalResources: TscnScene['externalResources']
) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={externalResources}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={nodes} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<NodeDispatcher> PackedScene instancing (WI-R3F-12)', () => {
  it('renders the loaded scene as children of the instancing node', async () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://child_cube.tscn', makeBoxScene('TheBox'));

    const instancingNode: TscnNode = {
      name: 'LeftCube',
      type: 'Node3D',
      instance: 'ExtResource("1_cube")',
      children: [],
      properties: {
        name: 'LeftCube',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: -3, y: 0, z: 0 },
        },
      } as Record<string, unknown>,
    };

    const renderer = await renderTree(
      [instancingNode],
      loader,
      [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
    );

    // The Node3D component wraps in a group with the instancing node's
    // transform; inside, the loaded scene's MeshInstance3D renders a mesh.
    const leftCubeGroup = renderer.scene.findAllByType('Group').find(
      (g) => g.instance.name === 'LeftCube'
    );
    expect(leftCubeGroup).toBeDefined();
    expect(leftCubeGroup!.instance.position.x).toBe(-3);

    const meshes = renderer.scene.findAllByType('Mesh');
    const namedMesh = meshes.find((m) => m.instance.name === 'TheBox');
    expect(namedMesh).toBeDefined();
  });

  it('renders a magenta placeholder when the referenced scene is missing', async () => {
    const { loader, setSceneMissing } = makeLoader();
    setSceneMissing('res://missing_scene.tscn');

    const instancingNode: TscnNode = {
      name: 'BrokenInstance',
      type: 'Node3D',
      instance: 'ExtResource("99_missing")',
      children: [],
      properties: { name: 'BrokenInstance' } as Record<string, unknown>,
    };

    const renderer = await renderTree(
      [instancingNode],
      loader,
      [
        {
          id: '99_missing',
          path: 'res://missing_scene.tscn',
          type: 'PackedScene',
        },
      ]
    );

    // The placeholder is a magenta wireframe BoxMesh with a floating label.
    const meshes = renderer.scene.findAllByType('Mesh');
    const magenta = meshes.find((m) => {
      const mat = m.instance.material as { color?: THREE.Color };
      return mat.color && mat.color.r > 0.9 && mat.color.g < 0.1 && mat.color.b > 0.9;
    });
    expect(magenta).toBeDefined();
  });

  it('recursively dispatches nested instancing (A → B → C)', async () => {
    const { loader, setSceneCached } = makeLoader();

    // Scene C: a single MeshInstance3D rendering a sphere.
    const sceneC: TscnScene = {
      nodes: [
        makeNode('Inner', 'MeshInstance3D', {
          properties: {
            name: 'Inner',
            mesh: 'SubResource("S_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
      externalResources: [],
      internalResources: [
        { id: 'S_1', type: 'SphereMesh', data: { id: 'S_1', radius: '0.5' } },
      ],
    };

    // Scene B: a Node3D that instances scene C.
    const sceneB: TscnScene = {
      nodes: [
        {
          name: 'MiddleRoot',
          type: 'Node3D',
          instance: 'ExtResource("c_ref")',
          children: [],
          properties: { name: 'MiddleRoot' } as Record<string, unknown>,
        },
      ],
      externalResources: [
        { id: 'c_ref', path: 'res://scene_c.tscn', type: 'PackedScene' },
      ],
      internalResources: [],
    };

    setSceneCached('res://scene_b.tscn', sceneB);
    setSceneCached('res://scene_c.tscn', sceneC);

    // Scene A: instances scene B.
    const sceneANodes: TscnNode[] = [
      {
        name: 'OuterRoot',
        type: 'Node3D',
        instance: 'ExtResource("b_ref")',
        children: [],
        properties: { name: 'OuterRoot' } as Record<string, unknown>,
      },
    ];

    const renderer = await renderTree(
      sceneANodes,
      loader,
      [{ id: 'b_ref', path: 'res://scene_b.tscn', type: 'PackedScene' }]
    );

    // The sphere should make it all the way through three levels of dispatch.
    const meshes = renderer.scene.findAllByType('Mesh');
    const sphere = meshes.find((m) => m.instance.name === 'Inner');
    expect(sphere).toBeDefined();
    const geom = sphere!.instance.geometry as { type: string };
    expect(geom.type).toBe('SphereGeometry');
  });

  it('renders multiple instances of the same scene at distinct positions', async () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://cube.tscn', makeBoxScene('TheBox'));

    const positions = [-3, 0, 3];
    const nodes: TscnNode[] = positions.map((x, i) => ({
      name: `Cube_${i}`,
      type: 'Node3D',
      instance: 'ExtResource("1_cube")',
      children: [],
      properties: {
        name: `Cube_${i}`,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x, y: 0, z: 0 },
        },
      } as Record<string, unknown>,
    }));

    const renderer = await renderTree(
      nodes,
      loader,
      [{ id: '1_cube', path: 'res://cube.tscn', type: 'PackedScene' }]
    );

    const groups = renderer.scene.findAllByType('Group');
    const cubeGroups = groups.filter((g) => /^Cube_\d$/.test(g.instance.name));
    expect(cubeGroups).toHaveLength(3);
    const xs = cubeGroups.map((g) => g.instance.position.x).sort((a, b) => a - b);
    expect(xs).toEqual([-3, 0, 3]);
    // Each instance produced its own mesh in the loaded scene.
    const meshes = renderer.scene.findAllByType('Mesh');
    const namedMeshes = meshes.filter((m) => m.instance.name === 'TheBox');
    expect(namedMeshes.length).toBe(3);
  });

  it('renders inline children AND instance-loaded children together on the same node', async () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://inner.tscn', makeBoxScene('FromInstance'));

    // Parent that has BOTH inline children (declared in the open file)
    // AND an instance ref. Both subtrees should appear.
    const parentNode: TscnNode = {
      name: 'Parent',
      type: 'Node3D',
      instance: 'ExtResource("inner_ref")',
      children: [
        makeNode('InlineMesh', 'MeshInstance3D', {
          properties: {
            name: 'InlineMesh',
            mesh: 'SubResource("Box_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
      properties: { name: 'Parent' } as Record<string, unknown>,
    };

    // The inline mesh needs Box_1 in the parent scene's internalResources.
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[
            { id: 'Box_1', type: 'BoxMesh', data: { id: 'Box_1', size: 'Vector3(1, 1, 1)' } },
          ]}
          externalResources={[
            { id: 'inner_ref', path: 'res://inner.tscn', type: 'PackedScene' },
          ]}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={[parentNode]} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    const inline = meshes.find((m) => m.instance.name === 'InlineMesh');
    const instanced = meshes.find((m) => m.instance.name === 'FromInstance');
    expect(inline).toBeDefined();
    expect(instanced).toBeDefined();
  });
});
