/**
 * Tests for PackedScene instance rendering.
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
import * as mergeInstanceRootModule from '../resources/mergeInstanceRoot';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';

// All node-type components self-register on import. Pull in the barrel
// so MeshInstance3D / Node3D / etc. dispatch through to their components.
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

    // The wrapper level is gone: the instance node IS the sub-scene root's
    // MeshInstance3D, named after the instance node and carrying its
    // transform — there is no intermediate 'TheBox' node anymore.
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
      const mat = m.instance.material as { color?: THREE.Color };
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
    const geom = sphere!.instance.geometry as { type: string };
    expect(geom.type).toBe('SphereGeometry');
    // The intermediate root names are gone — no wrapper levels survive.
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

    // Parent instances inner.tscn AND declares an added child of its own.
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

    // A scene with TWO top-level nodes cannot collapse into one instance node,
    // so it keeps the historical nesting: the instance node's own group holds
    // both loaded roots as children, addressed under the instance path.
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
    // The marquee Hallway shape: an instance node ('Wrapper') whose sub-scene
    // collapses in, but which the HOST also gave an added child ('Gadget')
    // that instances ANOTHER host resource. After the merge the added child is
    // dispatched under the sub-scene's resource pool; it must still resolve its
    // host-scoped ExtResource id (via SceneResourcesProvider inheritance) or it
    // silently fails to load and vanishes — exactly the lamps/doors regression.
    const fake = createFakeResourceLoader();

    // Sub-scene the Wrapper instances — its own pool does NOT contain the
    // gadget ref.
    const wrapperScene: TscnScene = {
      nodes: [makeNode('WrapperRoot', 'Node3D', { properties: { name: 'WrapperRoot' } as Record<string, unknown> })],
      externalResources: [],
      internalResources: [],
    };
    // The gadget sub-scene (a sphere), referenced only by a HOST ExtResource id.
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
        // Host-added child that instances a HOST resource id.
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

    // The added Gadget collapses to its sphere and renders — it resolved the
    // HOST 'gadget_ref' even though it lives under the collapsed Wrapper.
    const sphere = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === 'Gadget');
    expect(sphere).toBeDefined();
    expect((sphere!.instance.geometry as { type: string }).type).toBe('SphereGeometry');
  });

  it('REGRESSION (ADR-0013): the outermost instance transform REPLACES the nested root transforms', async () => {
    // Restored from main's deleted SceneManager.nested-external.test.ts, which
    // asserted COMPOSED world positions (2,0,3) for a 3-level nested chain.
    // Under Instance root merge that is the wrong model: each instance node's
    // transform overrides — does not compose with — the root it instances
    // (Godot parity). TopRoot's x=2 replaces MiddleWrapper's z=3, so the fully
    // collapsed leaf lands at (2,0,0). This pins the replace-not-compose
    // behavior and guards against re-introducing the double-transform.
    const fake = createFakeResourceLoader();

    // Level 3 (leaf): a single box mesh, NO transform.
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

    // Force-update the world matrix from the root down. Calling
    // `leaf.updateMatrixWorld(true)` alone updates only the leaf's
    // branch, which leaves parent local matrices unrecomputed in the
    // test renderer. R3F in production does this automatically per
    // frame; the test must do it manually.
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
    // collapseLiveNode/mergeInstanceRoot must be memoized per instance so an
    // unrelated re-render elsewhere in the tree (selection, hover, an
    // unrelated sibling's state) doesn't re-walk this instance's merge every
    // render — the same fix TreeNode.tsx already applies on the tree side.
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

    // Hoisted OUTSIDE the component so the reference stays stable across
    // re-renders — mirroring production, where these come from a
    // once-per-parse SceneGraph, not a fresh literal per render (a fresh
    // array/node every render would defeat ANY memoization strategy, not
    // just this one).
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

    // Re-render with a prop change that does NOT touch this instance's own
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
