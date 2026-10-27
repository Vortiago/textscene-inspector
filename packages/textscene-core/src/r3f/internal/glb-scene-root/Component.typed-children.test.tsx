/**
 * The node that instances a GLB is the GLB root, so each GLB object and each typed node attached
 * into the GLB has one path: the instancing node's path and the object's own. A node that declares a `type=` under a path inside an instanced GLB is a new node of that GLB
 * object. Godot adds it to the node its parent path resolves to (`packed_scene.cpp:157-165`,
 * `:541`), so the typed node takes that object's transform and visibility.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { parsedNode, translated } from '../../../parser/testing/parserKit';
import { NodeDispatcher } from '../../NodeDispatcher';
import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { SceneStack } from '../../testing/SceneStack';
import { useSelection, type SelectionContextValue } from '../../contexts/SelectionContext';
import { visibleInTree } from '../../visibleInTree';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { settleLoads } from '../../testing/settleLoads';
import { lineOpacities } from '../../testing/GizmoScene';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../../nodes/physics/shared/debugColor';
import * as logger from '../../../logger';

import '../../nodes/index';
import '../../../nodes/node/index';
import '../../../nodes/base/node3d/index';
import '../../../nodes/3d/meshinstance3d/index';

const GLB_PATH = 'res://rig.glb';
const INSTANCE_ORIGIN = 10;
const TORSO_HEIGHT = 2;
const TORSO_SCALE = 3;
const BOX_MESH = { id: 'Box', type: 'BoxMesh', data: {} };

/** Scene > Skeleton > Torso (raised and scaled) > Arm. Groups, so the typed node is the only mesh. */
function rigGlb(): THREE.Object3D {
  const named = (name: string) => Object.assign(new THREE.Group(), { name });
  const root = named('Scene');
  const skeleton = named('Skeleton');
  const torso = named('Torso');
  torso.position.set(0, TORSO_HEIGHT, 0);
  torso.scale.setScalar(TORSO_SCALE);
  torso.add(named('Arm'));
  skeleton.add(torso);
  root.add(skeleton);
  return root;
}

/** A typed MeshInstance3D whose parent path descends `subPath` into the GLB. */
function typedMesh(name: string, subPath: string, transform?: string): TscnNode {
  return {
    ...parsedNode(
      { name, type: 'MeshInstance3D' },
      { mesh: 'SubResource("Box")', ...(transform ? { transform } : {}) }
    ),
    instanceSubPath: subPath,
  };
}

/** A type-less override of a GLB object, as `[node name="Torso" parent="Rig/Skeleton"]` writes it. */
function override(name: string, subPath: string, raw: Record<string, string>): TscnNode {
  return {
    ...parsedNode({ name, type: 'Node3D' }, raw),
    type: '',
    instanceSubPath: subPath,
    overridesExistingNode: true,
  };
}

function rigInstance(children: TscnNode[]): TscnNode {
  return {
    ...parsedNode(
      { name: 'Rig', type: 'Node', instance: 'ExtResource("rig")' },
      { transform: translated(INSTANCE_ORIGIN, 0, 0) }
    ),
    children,
  };
}

let selection: SelectionContextValue;
function SelectionProbe() {
  selection = useSelection();
  return null;
}

let peekedScene: THREE.Scene | undefined;
function ScenePeek() {
  peekedScene = useThree((state) => state.scene);
  return null;
}
nodeComponentRegistry.register({ typeName: 'ScenePeek', Component: ScenePeek });

interface SceneSetup {
  /** The scene's roots, which instance `GLB_PATH` or a sub-scene that does. */
  roots: TscnNode[];
  externalResources: TscnScene['externalResources'];
  /** Sub-scenes the roots instance, by path. */
  subScenes?: ReadonlyMap<string, TscnScene>;
}

async function renderScene({ roots, externalResources, subScenes = new Map() }: SceneSetup) {
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, rigGlb());
  for (const [path, scene] of subScenes) fake.scenes.seed(path, scene);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: [BOX_MESH], externalResources }}>
      <SelectionProbe />
      <NodeDispatcher nodes={roots} />
    </SceneStack>
  );
  await settleLoads();
  renderer.scene.instance.updateMatrixWorld(true);
  return renderer;
}

/** The rig instanced directly, with `children` authored under the instancing node. */
function render(children: TscnNode[]) {
  return renderScene({
    roots: [rigInstance(children)],
    externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
  });
}

type Rendered = Awaited<ReturnType<typeof renderScene>>;

function meshesOf(renderer: Rendered): THREE.Object3D[] {
  return [...new Set(renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Object3D))];
}

/** The typed node's mesh, which is the only mesh in the scene. */
function onlyMesh(renderer: Rendered): THREE.Object3D {
  const meshes = meshesOf(renderer);
  expect(meshes).toHaveLength(1);
  return meshes[0]!;
}

function glbObject(renderer: Rendered, name: string): THREE.Object3D {
  const found = renderer.scene.instance.getObjectByName(name);
  expect(found, `GLB object "${name}" should be mounted`).toBeDefined();
  return found!;
}

function hasAncestor(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let node = object.parent; node; node = node.parent) if (node === ancestor) return true;
  return false;
}

afterEach(() => vi.restoreAllMocks());

describe('GLBSceneRoot — a typed node addressed into the GLB', () => {
  it('mounts under the matched GLB object, at that object’s world matrix times its own transform', async () => {
    const renderer = await render([typedMesh('Marker', 'Skeleton/Torso', translated(1, 0, 0))]);

    const marker = onlyMesh(renderer);
    expect(hasAncestor(marker, glbObject(renderer, 'Torso'))).toBe(true);
    const position = marker.getWorldPosition(new THREE.Vector3());
    // Instance origin, then the torso's raise, then the node's own 1 unit scaled by the torso.
    expect(position.x).toBeCloseTo(INSTANCE_ORIGIN + TORSO_SCALE, 5);
    expect(position.y).toBeCloseTo(TORSO_HEIGHT, 5);
    expect(position.z).toBeCloseTo(0, 5);
    expect(marker.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(TORSO_SCALE, 5);
  });

  it('mounts under the GLB a sub-scene instances, at any instance depth', async () => {
    const LAMP_PATH = 'res://lamp.tscn';
    const lamp: TscnScene = {
      nodes: [
        {
          ...parsedNode({ name: 'LampRoot', type: 'Node3D' }),
          children: [parsedNode({ name: 'Mesh', type: 'Node', instance: 'ExtResource("rig")' })],
        },
      ],
      externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    // `parent="Lamp/Mesh/Skeleton/Torso"`: the host instances the lamp, which instances the GLB.
    const marker = typedMesh('Marker', 'Mesh/Skeleton/Torso', translated(1, 0, 0));
    const renderer = await renderScene({
      roots: [
        {
          ...parsedNode({ name: 'Lamp', type: 'Node', instance: 'ExtResource("lamp")' }),
          children: [marker],
        },
      ],
      externalResources: [{ id: 'lamp', path: LAMP_PATH, type: 'PackedScene' }],
      subScenes: new Map([[LAMP_PATH, lamp]]),
    });

    const mesh = onlyMesh(renderer);
    expect(hasAncestor(mesh, glbObject(renderer, 'Torso'))).toBe(true);
    expect(mesh.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(TORSO_SCALE, 5);
    expect(hasAncestor(mesh, selection.nodeObjectMap.get('Lamp/Mesh/Skeleton/Torso/Marker')!)).toBe(true);
  });

  it('registers the GLB objects at the merged node when a sub-scene’s root instances the GLB', async () => {
    const LAMP_PATH = 'res://lamp.tscn';
    const lamp: TscnScene = {
      nodes: [parsedNode({ name: 'LampRoot', type: 'Node', instance: 'ExtResource("rig")' })],
      externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    await renderScene({
      roots: [parsedNode({ name: 'Lamp', type: 'Node', instance: 'ExtResource("lamp")' })],
      externalResources: [{ id: 'lamp', path: LAMP_PATH, type: 'PackedScene' }],
      subScenes: new Map([[LAMP_PATH, lamp]]),
    });

    expect([...selection.nodeObjectMap.keys()].filter((path) => path.endsWith('Torso'))).toEqual([
      'Lamp/Skeleton/Torso',
    ]);
  });

  it('registers exactly one object for the node’s path', async () => {
    const renderer = await render([typedMesh('Marker', 'Skeleton/Torso')]);

    expect(hasAncestor(onlyMesh(renderer), selection.nodeObjectMap.get('Rig/Skeleton/Torso/Marker')!)).toBe(
      true
    );
  });

  it('hides the GLB object its eye toggle names, at the path the tree shows it', async () => {
    const renderer = await render([]);

    expect(glbObject(renderer, 'Torso').visible).toBe(true);
    await ReactThreeTestRenderer.act(async () => selection.toggleHidden('Rig/Skeleton/Torso'));

    expect(glbObject(renderer, 'Torso').visible).toBe(false);
    expect(glbObject(renderer, 'Skeleton').visible).toBe(true);
  });

  it('registers each GLB object once, at the instancing node’s path and its own', async () => {
    await render([]);

    expect(selection.nodeObjectMap.get('Rig/Skeleton/Torso')).toBeInstanceOf(THREE.Object3D);
    expect(selection.nodeObjectMap.has('Rig/rig')).toBe(false);
  });

  it('registers two nodes of one name under different GLB nodes at their own paths', async () => {
    const renderer = await render([
      typedMesh('Marker', 'Skeleton/Torso'),
      typedMesh('Marker', 'Skeleton/Torso/Arm'),
    ]);

    const [torsoMarker, armMarker] = [
      selection.nodeObjectMap.get('Rig/Skeleton/Torso/Marker'),
      selection.nodeObjectMap.get('Rig/Skeleton/Torso/Arm/Marker'),
    ];
    expect(meshesOf(renderer)).toHaveLength(2);
    expect(torsoMarker).not.toBe(armMarker);
    expect(hasAncestor(armMarker!, glbObject(renderer, 'Arm'))).toBe(true);
  });

  it('mounts a child of an attached node once, below that node', async () => {
    const marker = {
      ...typedMesh('Marker', 'Skeleton/Torso'),
      children: [parsedNode({ name: 'Child', type: 'MeshInstance3D' }, { mesh: 'SubResource("Box")' })],
    };
    const renderer = await render([marker]);

    let meshes = 0;
    renderer.scene.instance.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBe(2);
  });

  it('reaches the object a type-less override of the same path moves, and leaves its transform alone', async () => {
    const moved = translated(0, 5, 0);
    const renderer = await render([
      override('Torso', 'Skeleton', { transform: moved }),
      typedMesh('Marker', 'Skeleton/Torso', translated(0, 0, 7)),
    ]);

    const torso = glbObject(renderer, 'Torso');
    expect(torso.position.y).toBeCloseTo(5, 5);
    expect(torso.position.z).toBeCloseTo(0, 5);
    expect(hasAncestor(onlyMesh(renderer), torso)).toBe(true);
  });

  it('draws no node for a type-less override of a top-level GLB object', async () => {
    const renderer = await render([override('Skeleton', '', { transform: translated(0, 5, 0) })]);

    expect(selection.nodeObjectMap.get('Rig/Skeleton')).toBe(glbObject(renderer, 'Skeleton'));
    expect(glbObject(renderer, 'Skeleton').position.y).toBeCloseTo(5, 5);
  });

  it('applies an override written below another override, and mounts a typed node below it', async () => {
    const nested = {
      ...override('Skeleton', '', {}),
      children: [
        {
          ...override('Torso', '', { transform: translated(0, 5, 0) }),
          children: [{ ...typedMesh('Marker', ''), instanceSubPath: undefined }],
        },
      ],
    };
    const renderer = await render([nested]);

    expect(glbObject(renderer, 'Torso').position.y).toBeCloseTo(5, 5);
    expect(hasAncestor(onlyMesh(renderer), glbObject(renderer, 'Torso'))).toBe(true);
    expect(selection.nodeObjectMap.get('Rig/Skeleton/Torso')).toBe(glbObject(renderer, 'Torso'));
  });

  it('is hidden with a hidden GLB ancestor', async () => {
    const renderer = await render([
      override('Torso', 'Skeleton', { visible: 'false' }),
      typedMesh('Marker', 'Skeleton/Torso'),
    ]);

    expect(visibleInTree(onlyMesh(renderer))).toBe(false);
  });

  it('keeps the viewport scene for a component inside the attached subtree', async () => {
    const peek = parsedNode({ name: 'Peek', type: 'Node3D' });
    const renderer = await render([{ ...peek, type: 'ScenePeek', instanceSubPath: 'Skeleton/Torso' }]);

    expect(peekedScene).toBe(renderer.scene.instance);
  });

  it('renders nothing and warns once for a path that names no GLB object', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await render([typedMesh('Marker', 'Nowhere/Else')]);

    expect(meshesOf(renderer)).toHaveLength(0);
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Nowhere/Else'))).toHaveLength(1);
  });
});

describe('GLBSceneRoot — the gizmo of a typed node attached into the GLB', () => {
  // The edited scene authored the node, so Godot gives its gizmo the node's own colour, not the
  // instantiated grey (`node_3d_editor_gizmos.cpp:43-60`). The unselected line draws at 0.3 of that alpha.
  const OWN_UNSELECTED_ALPHA = DEFAULT_COLLISION_DEBUG_COLOR.a * 0.3;

  function arm(subPath: string): TscnNode {
    return { ...parsedNode({ name: 'Arm', type: 'SpringArm3D' }), instanceSubPath: subPath };
  }

  it('draws in its own colour when the edited scene instances the GLB', async () => {
    const renderer = await render([arm('Skeleton/Torso')]);
    expect(lineOpacities(renderer)).toEqual([OWN_UNSELECTED_ALPHA, OWN_UNSELECTED_ALPHA]);
  });

  it('draws in its own colour when a sub-scene instances the GLB', async () => {
    const LAMP_PATH = 'res://lamp.tscn';
    const lamp: TscnScene = {
      nodes: [
        {
          ...parsedNode({ name: 'LampRoot', type: 'Node3D' }),
          children: [parsedNode({ name: 'Mesh', type: 'Node', instance: 'ExtResource("rig")' })],
        },
      ],
      externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    const renderer = await renderScene({
      roots: [
        {
          ...parsedNode({ name: 'Lamp', type: 'Node', instance: 'ExtResource("lamp")' }),
          children: [arm('Mesh/Skeleton/Torso')],
        },
      ],
      externalResources: [{ id: 'lamp', path: LAMP_PATH, type: 'PackedScene' }],
      subScenes: new Map([[LAMP_PATH, lamp]]),
    });
    expect(lineOpacities(renderer)).toEqual([OWN_UNSELECTED_ALPHA, OWN_UNSELECTED_ALPHA]);
  });
});
