/**
 * Instance-property overrides apply to nodes inside an instanced GLB, through the real
 * NodeDispatcher → InstancedSceneSubtree → GLBSceneRoot path. The `plafoniera` override keeps the
 * 0.189 scale and zeroes the baked translation (1.11, -9.73, -9.73), so the mesh sits at the
 * ceiling_lamp origin beside its OmniLight3D.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { GLB_SCENE_ROOT_TYPE } from './Component';
import { initGlbModules } from '../../../resources/processing/glbProcessing';

// Register node-type components (Node3D / OmniLight3D / GLBSceneRoot / …).
import '../../nodes/index';

// GLBSceneRoot clones through cloneWithMaterials, which needs the lazy GLB module cache.
beforeAll(async () => {
  await initGlbModules();
});

const GLB_PATH = 'res://assets/ceiling_lamp.glb';
const LAMP_TSCN = 'res://assets/ceiling_lamp.tscn';
const BAKED = { x: 1.1099722, y: -9.726781, z: -9.7296133 };
const SCALE = 0.18924935;

/** Build a GLB-like scene: a Group root with one named child mesh at the baked translation. */
function makeFakeGlb(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = 'plafoniera';
  mesh.position.set(BAKED.x, BAKED.y, BAKED.z);
  mesh.scale.set(SCALE, SCALE, SCALE);
  root.add(mesh);
  return root;
}

/** The synthesised single-node GLBSceneRoot scene createSceneProcessor produces for a .glb. */
function makeSynthesisedGlbScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'ceiling_lamp',
        type: GLB_SCENE_ROOT_TYPE,
        children: [],
        properties: { glbPath: GLB_PATH } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  };
}

/** ceiling_lamp.tscn: root instances the GLB, with a `plafoniera` transform override + OmniLight3D. */
function makeCeilingLampScene(): TscnScene {
  const root: TscnNode = {
    name: 'ceiling_lamp',
    type: 'Node',
    instance: `ExtResource("glb_1")`,
    children: [
      {
        name: 'plafoniera',
        type: 'Node',
        children: [],
        properties: {
          name: 'plafoniera',
          index: 0,
          transform: {
            basis_x: { x: SCALE, y: 0, z: 0 },
            basis_y: { x: 0, y: SCALE, z: 0 },
            basis_z: { x: 0, y: 0, z: SCALE },
            origin: { x: 0, y: 0, z: 0 },
          },
        } as Record<string, unknown>,
      },
      {
        name: 'OmniLight3D',
        type: 'OmniLight3D',
        children: [],
        properties: { name: 'OmniLight3D' } as Record<string, unknown>,
      },
    ],
    properties: { name: 'ceiling_lamp' } as Record<string, unknown>,
  };
  return {
    nodes: [root],
    externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
    internalResources: [],
  };
}

/** Hallway-level instancing node: ceiling_lamp at origin (8.803779, 4, 0). */
function makeHallwayLampNode(): TscnNode {
  return {
    name: 'ceiling_lamp',
    type: 'Node3D',
    instance: `ExtResource("lamp_1")`,
    children: [],
    properties: {
      name: 'ceiling_lamp',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 8.803779, y: 4, z: 0 },
      },
    } as Record<string, unknown>,
  };
}

async function renderHallwayLamp(loader: ResourceLoader) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={[]}
        externalResources={[{ id: 'lamp_1', path: LAMP_TSCN, type: 'PackedScene' }]}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={[makeHallwayLampNode()]} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function findMeshWorldPosition(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  name: string
): THREE.Vector3 {
  const mesh = renderer.scene.findAllByType('Mesh').find((m) => m.instance.name === name);
  expect(mesh, `mesh "${name}" should be rendered`).toBeDefined();
  const obj = mesh!.instance as THREE.Object3D;
  // Walk to the scene root and force a world-matrix update.
  let top: THREE.Object3D = obj;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  return obj.getWorldPosition(new THREE.Vector3());
}

describe('GLBSceneRoot — BUG 2 instance override onto GLB-internal node', () => {
  it('zeroes the GLB plafoniera baked translation per the .tscn override', async () => {
    const fake = createFakeResourceLoader();
    fake.scenes.seed(LAMP_TSCN, makeCeilingLampScene());
    fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
    fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());

    const renderer = await renderHallwayLamp(fake.loader);

    const pos = findMeshWorldPosition(renderer, 'plafoniera');

    // Expected: ceiling_lamp origin (8.803779, 4, 0) + override origin (0,0,0).
    // Not ceiling_lamp origin + baked (1.11, -9.73, -9.73).
    expect(pos.x).toBeCloseTo(8.803779, 4);
    expect(pos.y).toBeCloseTo(4, 4);
    expect(pos.z).toBeCloseTo(0, 4);

    // Guard against the buggy value explicitly.
    expect(pos.y).not.toBeCloseTo(4 + BAKED.y, 1);
  });

  it('leaves a GLB internal node untouched when the .tscn declares no override for it', async () => {
    const fake = createFakeResourceLoader();

    // With no override children the GLB keeps its baked transform: translations are not zeroed
    // globally.
    const noOverrideScene: TscnScene = {
      nodes: [
        {
          name: 'ceiling_lamp',
          type: 'Node',
          instance: `ExtResource("glb_1")`,
          children: [],
          properties: { name: 'ceiling_lamp' } as Record<string, unknown>,
        },
      ],
      externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    fake.scenes.seed(LAMP_TSCN, noOverrideScene);
    fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
    fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());

    const renderer = await renderHallwayLamp(fake.loader);
    const pos = findMeshWorldPosition(renderer, 'plafoniera');

    // Baked translation survives: ceiling_lamp origin + baked.
    expect(pos.x).toBeCloseTo(8.803779 + BAKED.x, 4);
    expect(pos.y).toBeCloseTo(4 + BAKED.y, 4);
    expect(pos.z).toBeCloseTo(0 + BAKED.z, 4);
  });

  it('keeps an override’s `visible = false` hidden after the tree’s visibility pass', async () => {
    // Two writers, one field: the override applies during render, and the hidden-paths effect
    // then assigns `visible` for every GLB object. Only the mounted object shows the clobber, so a
    // unit test of `applyGlbNodeOverrides` passes either way.
    const fake = createFakeResourceLoader();
    const hiddenScene = makeCeilingLampScene();
    const override = hiddenScene.nodes[0]!.children.find((c) => c.name === 'plafoniera')!;
    override.rawProperties = { visible: 'false' };

    fake.scenes.seed(LAMP_TSCN, hiddenScene);
    fake.scenes.seed(GLB_PATH, makeSynthesisedGlbScene());
    fake.glbMeshes.seed(GLB_PATH, makeFakeGlb());

    const renderer = await renderHallwayLamp(fake.loader);

    const mesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.name === 'plafoniera');
    expect(mesh).toBeDefined();
    expect((mesh!.instance as THREE.Object3D).visible).toBe(false);
  });
});
