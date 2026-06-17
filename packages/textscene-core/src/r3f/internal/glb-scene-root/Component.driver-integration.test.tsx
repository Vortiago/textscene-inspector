/**
 * End-to-end check that the GLB animation driver binds to the SAME node path
 * the scene tree selects. The unit tests wrap GLBSceneRoot in an explicit
 * NodePathProvider; this drives the real NodeDispatcher → InstancedNode →
 * GLBSceneRoot path so a regression in path composition (joinPath of the
 * instance node + the synthesised GLB root's basename) would surface as the
 * Animation tab failing to populate on selection.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../contexts/AnimationTransportContext';
import {
  SelectionProvider,
  useOptionalSelection,
  type SelectionContextValue,
} from '../../contexts/SelectionContext';
import { GLB_SCENE_ROOT_TYPE } from './Component';

// Register node-type components (Node3D / GLBSceneRoot / …).
import '../../nodes/index';

const GLB_PATH = 'res://player.glb';

function makeAnimatedGlb(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'Scene';
  const clip = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('Scene.position', [0, 1], [0, 0, 0, 0, 0, 0]),
  ]);
  root.animations = [clip];
  return root;
}

/** The synthesised single-node GLBSceneRoot scene a .glb PackedScene yields. */
function makeSynthScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'player', // basename of player.glb
        type: GLB_SCENE_ROOT_TYPE,
        children: [],
        properties: { glbPath: GLB_PATH } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [],
  };
}

function makeLoader() {
  const eventBus = new ResourceEventBus();
  const sceneCache = new Map<string, TscnScene | null>([[GLB_PATH, makeSynthScene()]]);
  const glbCache = new Map<string, THREE.Object3D | null>([[GLB_PATH, makeAnimatedGlb()]]);
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });
  return {
    eventBus,
    glbMeshes: makeProc<THREE.Object3D>(glbCache),
    scenes: makeProc<TscnScene>(sceneCache),
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: vi.fn(),
    register: vi.fn(),
  } as unknown as ResourceLoader;
}

/** Host: a Player instance node whose instance is the GLB directly. */
function makeHostNode(): TscnNode {
  return {
    name: 'Player',
    type: 'Node3D',
    instance: 'ExtResource("glb_1")',
    children: [],
    properties: { name: 'Player' } as Record<string, unknown>,
  };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

describe('GLB driver — selection path through the real dispatcher', () => {
  it('populates the transport when the GLB row path (Player/player) is selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={makeLoader()}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: 'glb_1', path: GLB_PATH, type: 'PackedScene' }]}
        >
          <SelectionProvider>
            <AnimationTransportProvider>
              <Capture />
              <NodeDispatcher nodes={[makeHostNode()]} />
            </AnimationTransportProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    // Nothing selected → no driver registered.
    expect(transport.clips).toEqual([]);

    // Select the GLB row at its dispatcher-composed path.
    await ReactThreeTestRenderer.act(async () =>
      selection?.setSelectedNodePath('Player/player')
    );

    expect(transport.hasPlayer).toBe(true);
    expect(transport.clips).toEqual(['idle']);

    await renderer.unmount();
  });
});
