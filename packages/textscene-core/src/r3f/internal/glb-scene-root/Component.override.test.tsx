/**
 * BUG 2 regression: Godot instance-property overrides must be applied to
 * nodes INSIDE an instanced GLB.
 *
 * roof_lamp.tscn instances roof_lamp.glb, whose internal `plafoniera`
 * node carries a large baked translation (1.11, -9.73, -9.73). The
 * .tscn declares an override `[node name="plafoniera" parent="." index=0]`
 * that keeps the 0.189 scale but resets translation to (0,0,0). Pre-fix
 * the renderer mounted the GLB as an opaque <primitive> and the baked
 * translation survived, floating the lamp mesh ~13.8 units from where
 * Godot (and its co-located OmniLight3D) places it.
 *
 * This test drives the real NodeDispatcher → InstancedSceneSubtree →
 * GLBSceneRoot path with a fake GLB whose `plafoniera` node sits at the
 * baked translation, and asserts the override zeroes it so the mesh ends
 * up at the roof_lamp origin — co-located with the OmniLight3D.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { MetadataStore } from '../../../resources/MetadataStore';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { GLB_SCENE_ROOT_TYPE } from './Component';
import { initGlbModules } from '../../../resources/processing/glbProcessing';

// Register node-type components (Node3D / OmniLight3D / GLBSceneRoot / …).
import '../../nodes/index';

// GLBSceneRoot clones Object3D via cloneWithMaterials which requires the lazy
// GLB module cache to be initialised first.
beforeAll(async () => {
  await initGlbModules();
});

const GLB_PATH = 'res://assets/roof_lamp.glb';
const LAMP_TSCN = 'res://assets/roof_lamp.tscn';
const BAKED = { x: 1.1099722, y: -9.726781, z: -9.7296133 };
const SCALE = 0.18924935;

function makeLoader() {
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
    pin: () => {},
    unpin: () => {},
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
    clear: () => {},
  } as unknown as ResourceLoader;

  return {
    loader,
    setSceneCached: (p: string, s: TscnScene) => sceneCache.set(p, s),
    setGlbCached: (p: string, o: THREE.Object3D) => glbCache.set(p, o),
  };
}

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
        name: 'roof_lamp',
        type: GLB_SCENE_ROOT_TYPE,
        children: [],
        properties: { glbPath: GLB_PATH } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  };
}

/** roof_lamp.tscn: root instances the GLB, with a `plafoniera` transform override + OmniLight3D. */
function makeRoofLampScene(): TscnScene {
  const root: TscnNode = {
    name: 'roof_lamp',
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
    properties: { name: 'roof_lamp' } as Record<string, unknown>,
  };
  return {
    nodes: [root],
    externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
    internalResources: [],
  };
}

/** Hallway-level instancing node: roof_lamp at origin (8.803779, 4, 0). */
function makeHallwayLampNode(): TscnNode {
  return {
    name: 'roof_lamp',
    type: 'Node3D',
    instance: `ExtResource("lamp_1")`,
    children: [],
    properties: {
      name: 'roof_lamp',
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
    const { loader, setSceneCached, setGlbCached } = makeLoader();
    setSceneCached(LAMP_TSCN, makeRoofLampScene());
    setSceneCached(GLB_PATH, makeSynthesisedGlbScene());
    setGlbCached(GLB_PATH, makeFakeGlb());

    const renderer = await renderHallwayLamp(loader);

    const pos = findMeshWorldPosition(renderer, 'plafoniera');

    // Expected: roof_lamp origin (8.803779, 4, 0) + override origin (0,0,0).
    // NOT roof_lamp origin + baked (1.11, -9.73, -9.73).
    expect(pos.x).toBeCloseTo(8.803779, 4);
    expect(pos.y).toBeCloseTo(4, 4);
    expect(pos.z).toBeCloseTo(0, 4);

    // Guard against the buggy value explicitly.
    expect(pos.y).not.toBeCloseTo(4 + BAKED.y, 1);
  });

  it('leaves a GLB internal node untouched when the .tscn declares no override for it', async () => {
    const { loader, setSceneCached, setGlbCached } = makeLoader();

    // roof_lamp.tscn with NO override children — the GLB should keep its
    // baked transform (we must not zero translations globally).
    const noOverrideScene: TscnScene = {
      nodes: [
        {
          name: 'roof_lamp',
          type: 'Node',
          instance: `ExtResource("glb_1")`,
          children: [],
          properties: { name: 'roof_lamp' } as Record<string, unknown>,
        },
      ],
      externalResources: [{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    setSceneCached(LAMP_TSCN, noOverrideScene);
    setSceneCached(GLB_PATH, makeSynthesisedGlbScene());
    setGlbCached(GLB_PATH, makeFakeGlb());

    const renderer = await renderHallwayLamp(loader);
    const pos = findMeshWorldPosition(renderer, 'plafoniera');

    // Baked translation survives: roof_lamp origin + baked.
    expect(pos.x).toBeCloseTo(8.803779 + BAKED.x, 4);
    expect(pos.y).toBeCloseTo(4 + BAKED.y, 4);
    expect(pos.z).toBeCloseTo(0 + BAKED.z, 4);
  });
});
