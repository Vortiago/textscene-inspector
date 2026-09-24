/**
 * PackedScene instance rendering: a node with `instance = ExtResource(...)`
 * renders the loaded scene with its own transform, a placeholder when the scene
 * is missing, nested and repeated instances, and inline children beside them.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import * as mergeInstanceRootModule from '../resources/mergeInstanceRoot';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';

// The barrel registers every node-type component.
import './nodes/index';

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

describe('<NodeDispatcher> PackedScene instancing + Instance root merge (WI-R3F-12, ADR-0013)', () => {
  it('collapses a single-root instance: the instance node becomes the root, keeping its name + transform', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://child_cube.tscn', makeBoxScene('TheBox'));

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
      fake.loader,
      [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
    );

    // No wrapper level: the instance node is the sub-scene root's MeshInstance3D,
    // with the instance node's name and transform, and no 'TheBox' node.
    const meshes = renderer.scene.findAllByType('Mesh');
    const merged = meshes.find((m) => m.instance.name === 'LeftCube');
    expect(merged).toBeDefined();
    expect(merged!.instance.position.x).toBe(-3);
    expect(meshes.find((m) => m.instance.name === 'TheBox')).toBeUndefined();
  });

  it('renders a magenta placeholder when the referenced scene is missing', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://missing_scene.tscn', null);

    const instancingNode: TscnNode = {
      name: 'BrokenInstance',
      type: 'Node3D',
      instance: 'ExtResource("99_missing")',
      children: [],
      properties: { name: 'BrokenInstance' } as Record<string, unknown>,
    };

    const renderer = await renderTree(
      [instancingNode],
      fake.loader,
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
      const mat = (m.instance as THREE.Mesh).material as { color?: THREE.Color };
      return mat.color && mat.color.r > 0.9 && mat.color.g < 0.1 && mat.color.b > 0.9;
    });
    expect(magenta).toBeDefined();
  });

  it('recursively collapses nested instancing (A → B → C) down to a single node', async () => {
    const fake = createFakeResourceLoader();

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

    fake.scenes.seed('res://scene_b.tscn', sceneB);
    fake.scenes.seed('res://scene_c.tscn', sceneC);

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
      fake.loader,
      [{ id: 'b_ref', path: 'res://scene_b.tscn', type: 'PackedScene' }]
    );

    // The sphere makes it through three levels of dispatch, fully collapsed:
    // each level's instance ref is consumed, leaving one MeshInstance3D named
    // after the outermost instance node ('OuterRoot'), not the leaf root.
    const meshes = renderer.scene.findAllByType('Mesh');
    const sphere = meshes.find((m) => m.instance.name === 'OuterRoot');
    expect(sphere).toBeDefined();
    const geom = (sphere!.instance as THREE.Mesh).geometry as { type: string };
    expect(geom.type).toBe('SphereGeometry');
    // No intermediate root name survives.
    expect(meshes.find((m) => m.instance.name === 'Inner')).toBeUndefined();
  });

  it('renders multiple instances of the same scene at distinct positions', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://cube.tscn', makeBoxScene('TheBox'));

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
      fake.loader,
      [{ id: '1_cube', path: 'res://cube.tscn', type: 'PackedScene' }]
    );

    // Each instance collapses into its own MeshInstance3D, named after the
    // instance node and positioned by the instance's transform.
    const meshes = renderer.scene.findAllByType('Mesh');
    const cubeMeshes = meshes.filter((m) => /^Cube_\d$/.test(m.instance.name));
    expect(cubeMeshes).toHaveLength(3);
    const xs = cubeMeshes.map((m) => m.instance.position.x).sort((a, b) => a - b);
    expect(xs).toEqual([-3, 0, 3]);
  });

  it('merges children the host added under the instance alongside the collapsed root subtree', async () => {
    const fake = createFakeResourceLoader();

    // Sub-scene whose root is a transform-only container (Node3D) holding a
    // mesh. Merging onto a container preserves both the root's own children
    // and the children the host added under the instance node.
    const innerScene: TscnScene = {
      nodes: [
        makeNode('InnerRoot', 'Node3D', {
          properties: { name: 'InnerRoot' } as Record<string, unknown>,
          children: [
            makeNode('FromInstance', 'MeshInstance3D', {
              properties: {
                name: 'FromInstance',
                mesh: 'SubResource("Box_1")',
                surfaceMaterialOverrides: new Map(),
              } as Record<string, unknown>,
            }),
          ],
        }),
      ],
      externalResources: [],
      internalResources: [
        { id: 'Box_1', type: 'BoxMesh', data: { id: 'Box_1', size: 'Vector3(1, 1, 1)' } },
      ],
    };
    fake.scenes.seed('res://inner.tscn', innerScene);

    // Parent instances inner.tscn and declares an added child of its own.
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

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
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
    // The collapsed root keeps its own mesh, and the host-added child renders
    // beside it under the single merged node named 'Parent'.
    const inline = meshes.find((m) => m.instance.name === 'InlineMesh');
    const instanced = meshes.find((m) => m.instance.name === 'FromInstance');
    expect(inline).toBeDefined();
    expect(instanced).toBeDefined();
    // The merged node adopts the instance node's name; the root's name is gone.
    expect(renderer.scene.findAllByType('Group').find((g) => g.instance.name === 'Parent')).toBeDefined();
    expect(renderer.scene.findAllByType('Group').find((g) => g.instance.name === 'InnerRoot')).toBeUndefined();
  });

  it('falls back to the nested form when the loaded scene has multiple roots', async () => {
    const fake = createFakeResourceLoader();

    // A scene with two top-level nodes cannot merge into one instance node, so
    // the instance node's own group holds both loaded roots as children,
    // addressed under the instance path.
    const multiRootScene: TscnScene = {
      nodes: [
        makeNode('RootA', 'MeshInstance3D', {
          properties: {
            name: 'RootA',
            mesh: 'SubResource("Box_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
        makeNode('RootB', 'MeshInstance3D', {
          properties: {
            name: 'RootB',
            mesh: 'SubResource("Box_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
      externalResources: [],
      internalResources: [
        { id: 'Box_1', type: 'BoxMesh', data: { id: 'Box_1', size: 'Vector3(1, 1, 1)' } },
      ],
    };
    fake.scenes.seed('res://multi.tscn', multiRootScene);

    const instancingNode: TscnNode = {
      name: 'MultiHost',
      type: 'Node3D',
      instance: 'ExtResource("multi_ref")',
      children: [],
      properties: { name: 'MultiHost' } as Record<string, unknown>,
    };

    const renderer = await renderTree(
      [instancingNode],
      fake.loader,
      [{ id: 'multi_ref', path: 'res://multi.tscn', type: 'PackedScene' }]
    );

    // The instancing node's own group survives (no collapse), and both roots
    // render under it by their own names.
    const groups = renderer.scene.findAllByType('Group');
    expect(groups.find((g) => g.instance.name === 'MultiHost')).toBeDefined();
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.find((m) => m.instance.name === 'RootA')).toBeDefined();
    expect(meshes.find((m) => m.instance.name === 'RootB')).toBeDefined();
  });

  it('REGRESSION (hallway): a host-added child of a collapsed instance still resolves HOST ExtResources', async () => {
    // 'Wrapper' merges its sub-scene, and the host gives it a child 'Gadget' that
    // instances another host resource. Under the sub-scene's pool, 'Gadget' must
    // still resolve its host-scoped ExtResource id, or it does not load.
    const fake = createFakeResourceLoader();

    // The Wrapper's sub-scene, whose own pool does not hold the gadget ref.
    const wrapperScene: TscnScene = {
      nodes: [makeNode('WrapperRoot', 'Node3D', { properties: { name: 'WrapperRoot' } as Record<string, unknown> })],
      externalResources: [],
      internalResources: [],
    };
    // The gadget sub-scene (a sphere), referenced only by a host ExtResource id.
    const gadgetScene: TscnScene = {
      nodes: [
        makeNode('GadgetRoot', 'MeshInstance3D', {
          properties: {
            name: 'GadgetRoot',
            mesh: 'SubResource("S_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
      externalResources: [],
      internalResources: [{ id: 'S_1', type: 'SphereMesh', data: { id: 'S_1', radius: '0.5' } }],
    };
    fake.scenes.seed('res://wrapper.tscn', wrapperScene);
    fake.scenes.seed('res://gadget.tscn', gadgetScene);

    const wrapperNode: TscnNode = {
      name: 'Wrapper',
      type: 'Node3D',
      instance: 'ExtResource("wrapper_ref")',
      children: [
        // Host-added child that instances a host resource id.
        { name: 'Gadget', type: 'Node3D', instance: 'ExtResource("gadget_ref")', children: [], properties: { name: 'Gadget' } as Record<string, unknown> },
      ],
      properties: { name: 'Wrapper' } as Record<string, unknown>,
    };

    const renderer = await renderTree(
      [wrapperNode],
      fake.loader,
      [
        { id: 'wrapper_ref', path: 'res://wrapper.tscn', type: 'PackedScene' },
        { id: 'gadget_ref', path: 'res://gadget.tscn', type: 'PackedScene' },
      ]
    );

    // Gadget merges to its sphere and renders: it resolved the host 'gadget_ref'
    // under the merged Wrapper.
    const sphere = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Gadget');
    expect(sphere).toBeDefined();
    expect(((sphere!.instance as THREE.Mesh).geometry as { type: string }).type).toBe('SphereGeometry');
  });

  it('REGRESSION (ADR-0013): the outermost instance transform REPLACES the nested root transforms', async () => {
    // An instance node's transform replaces the transform of the root it
    // instances, as in Godot, and does not compose with it. TopRoot's x=2
    // replaces MiddleWrapper's z=3, so the merged leaf lands at (2,0,0).
    const fake = createFakeResourceLoader();

    // Level 3 (leaf): a single box mesh, no transform.
    const leafScene: TscnScene = {
      nodes: [
        makeNode('LeafBox', 'MeshInstance3D', {
          properties: {
            name: 'LeafBox',
            mesh: 'SubResource("Box_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
      externalResources: [],
      internalResources: [
        {
          id: 'Box_1',
          type: 'BoxMesh',
          data: { id: 'Box_1', size: 'Vector3(1, 1, 1)' },
        },
      ],
    };

    // Level 2 (middle): a Node3D wrapper translated z=3 that instances leaf.
    const middleScene: TscnScene = {
      nodes: [
        {
          name: 'MiddleWrapper',
          type: 'Node3D',
          instance: 'ExtResource("leaf_ref")',
          children: [],
          properties: {
            name: 'MiddleWrapper',
            transform: {
              basis_x: { x: 1, y: 0, z: 0 },
              basis_y: { x: 0, y: 1, z: 0 },
              basis_z: { x: 0, y: 0, z: 1 },
              origin: { x: 0, y: 0, z: 3 },
            },
          } as Record<string, unknown>,
        },
      ],
      externalResources: [
        { id: 'leaf_ref', path: 'res://leaf.tscn', type: 'PackedScene' },
      ],
      internalResources: [],
    };

    fake.scenes.seed('res://leaf.tscn', leafScene);
    fake.scenes.seed('res://middle.tscn', middleScene);

    // Level 1 (top): a Node3D translated x=2 that instances middle.
    const topNodes: TscnNode[] = [
      {
        name: 'TopRoot',
        type: 'Node3D',
        instance: 'ExtResource("middle_ref")',
        children: [],
        properties: {
          name: 'TopRoot',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 2, y: 0, z: 0 },
          },
        } as Record<string, unknown>,
      },
    ];

    const renderer = await renderTree(
      topNodes,
      fake.loader,
      [{ id: 'middle_ref', path: 'res://middle.tscn', type: 'PackedScene' }]
    );

    // Fully collapsed: the chain becomes a single MeshInstance3D named after
    // the outermost instance node ('TopRoot'); the 'LeafBox' wrapper is gone.
    const meshes = renderer.scene.findAllByType('Mesh');
    const leaf = meshes.find((m) => m.instance.name === 'TopRoot');
    expect(leaf).toBeDefined();

    // From the root down: `leaf.updateMatrixWorld(true)` leaves the parent
    // matrices stale in the test renderer, which has no per-frame update.
    let root: THREE.Object3D = leaf!.instance;
    while (root.parent) root = root.parent;
    root.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    worldPos.setFromMatrixPosition(leaf!.instance.matrixWorld);

    // Replace semantics: TopRoot's transform (x=2) overrides MiddleWrapper's
    // (z=3) entirely; LeafBox has none. Final world position = (2, 0, 0).
    expect(worldPos.x).toBeCloseTo(2, 4);
    expect(worldPos.y).toBeCloseTo(0, 4);
    expect(worldPos.z).toBeCloseTo(0, 4);
  });

  it('PERF (WI-213): does not re-merge an instance subtree on an unrelated re-render', async () => {
    // The merge is memoized per instance, so a re-render elsewhere in the tree
    // does not re-walk it.
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://child_cube.tscn', makeBoxScene('TheBox'));

    const instancingNode: TscnNode = {
      name: 'LeftCube',
      type: 'Node3D',
      instance: 'ExtResource("1_cube")',
      children: [],
      properties: { name: 'LeftCube' } as Record<string, unknown>,
    };

    const mergeSpy = vi.spyOn(mergeInstanceRootModule, 'mergeInstanceRoot');

    // Outside the component, so the references stay stable across re-renders,
    // as they do from a once-per-parse SceneGraph.
    const internalResources: TscnScene['internalResources'] = [];
    const externalResources: TscnScene['externalResources'] = [
      { id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' },
    ];

    function Harness({ tick }: { tick: number }) {
      return (
        <ResourceLoaderProvider loader={fake.loader}>
          <SceneResourcesProvider
            internalResources={internalResources}
            externalResources={externalResources}
          >
            <SelectionProvider>
              {/* An unrelated state value forced into the tree so the whole
                  subtree re-renders without any of the instance's own inputs
                  (node/scenePath/loadedScene/externalResources) changing. */}
              <group userData={{ tick }} />
              <NodeDispatcher nodes={[instancingNode]} />
            </SelectionProvider>
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      );
    }

    const renderer = await ReactThreeTestRenderer.create(<Harness tick={0} />);
    const callsAfterFirstRender = mergeSpy.mock.calls.length;
    expect(callsAfterFirstRender).toBeGreaterThan(0);

    // Re-render with a prop change that does not touch this instance's own
    // memo deps.
    await renderer.update(<Harness tick={1} />);
    await renderer.update(<Harness tick={2} />);

    expect(mergeSpy.mock.calls.length).toBe(callsAfterFirstRender);
    mergeSpy.mockRestore();
  });

  it('PERF (WI-213): registers the instanced ExtResource from an effect, not the render body', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://child_cube.tscn', makeBoxScene('TheBox'));

    const instancingNode: TscnNode = {
      name: 'LeftCube',
      type: 'Node3D',
      instance: 'ExtResource("1_cube")',
      children: [],
      properties: { name: 'LeftCube' } as Record<string, unknown>,
    };

    await renderTree(
      [instancingNode],
      fake.loader,
      [{ id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' }]
    );

    // Behavior is preserved (registration still happens, so the resource
    // pipeline can resolve the instanced scene) even though the call now
    // lives inside a useEffect instead of the render body.
    expect(fake.registerCalls).toContainEqual({
      id: '1_cube',
      path: 'res://child_cube.tscn',
      type: 'PackedScene',
    });
  });
});
