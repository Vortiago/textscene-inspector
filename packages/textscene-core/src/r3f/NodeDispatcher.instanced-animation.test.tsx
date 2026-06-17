/**
 * Acceptance for #114 + ADR-0012/ADR-0013: an AnimationPlayer INSIDE an
 * instanced sub-scene binds the selection-driven Animation transport through
 * the COLLAPSED node path.
 *
 * Instance root merge drops the sub-scene wrapper level, so the player that
 * Godot shows at `Coins/Coin1/Animation` must be dispatched at exactly that
 * path (not `Coins/Coin1/Coin/Animation`). Because the tree, the dispatcher,
 * and `resolveNodeByPath` all run the same merge, `selectedNodePath` matches
 * the player's `useNodePath()` and the tab activates. This test pins that the
 * collapsed path activates the transport and the old wrapper path does not.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import {
  SelectionProvider,
  useOptionalSelection,
  type SelectionContextValue,
} from './contexts/SelectionContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from './contexts/AnimationTransportContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../resources/ResourceEventBus';
import { MetadataStore } from '../resources/MetadataStore';
import type { ResourceLoader } from '../resources/ResourceLoader';
import { AnimationProcessMode, MethodCallMode } from '../nodes/animation/animationplayer/types';

import './nodes/index';

function makeLoader(): { loader: ResourceLoader; setSceneCached: (p: string, s: TscnScene) => void } {
  const sceneCache = new Map<string, TscnScene | null>();
  const makeProc = <T,>(cache: Map<string, T | null>) => ({
    request: vi.fn(),
    getCached: (p: string) => cache.get(p),
    isCached: (p: string) => cache.has(p),
    isLoading: () => false,
    clearCache: () => {},
    getCacheSize: () => cache.size,
  });
  const loader = {
    eventBus: new ResourceEventBus(),
    metadata: new MetadataStore(),
    textures: makeProc(new Map()),
    materials: makeProc(new Map()),
    glbMeshes: makeProc(new Map()),
    scenes: makeProc<TscnScene>(sceneCache),
    getSceneCached: (p: string) => sceneCache.get(p),
    requestScene: vi.fn(),
    register: vi.fn(),
    provideFile: () => {},
    clear: () => sceneCache.clear(),
  } as unknown as ResourceLoader;
  return { loader, setSceneCached: (p, s) => sceneCache.set(p, s) };
}

// AnimationLibrary with one "slide" clip moving a sibling Target.
const INTERNAL: TscnInternalResource[] = [
  { id: 'Lib', type: 'AnimationLibrary', data: { _data: '{\n"slide": SubResource("A")\n}' } },
  {
    id: 'A',
    type: 'Animation',
    data: {
      length: '1.0',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Target:position")',
      'tracks/0/keys':
        '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]\n}',
    },
  },
];

function makeAnimationPlayerNode(): TscnNode {
  return {
    name: 'Animation',
    type: 'AnimationPlayer',
    children: [],
    properties: {
      name: 'Animation',
      speed_scale: 1.0,
      playback_default_blend_time: 0.0,
      playback_process_mode: AnimationProcessMode.IDLE,
      method_call_mode: MethodCallMode.DEFERRED,
      playback_active: true,
      autoplay: '',
      current_animation: '',
      current_animation_length: 0.0,
      current_animation_position: 0.0,
      root_node: 'NodePath("..")',
      libraries: [{ name: '', subResourceId: 'Lib' }],
    } as Record<string, unknown>,
  };
}

/** Sub-scene: an Area3D root 'Coin' holding the AnimationPlayer + its Target. */
function makeCoinScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'Coin',
        type: 'Area3D',
        instance: undefined,
        children: [
          makeAnimationPlayerNode(),
          {
            name: 'Target',
            type: 'MeshInstance3D',
            children: [],
            properties: {
              name: 'Target',
              mesh: 'SubResource("BoxMesh_1")',
              surfaceMaterialOverrides: new Map(),
            } as Record<string, unknown>,
          },
        ],
        properties: { name: 'Coin' } as Record<string, unknown>,
      },
    ],
    externalResources: [],
    internalResources: [
      ...INTERNAL,
      { id: 'BoxMesh_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
    ],
  };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

async function setSelection(path: string | null) {
  await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));
}

describe('instanced AnimationPlayer — selection-driven tab via the collapsed path', () => {
  it('activates the transport at the collapsed path, not the old wrapper path', async () => {
    const { loader, setSceneCached } = makeLoader();
    setSceneCached('res://coin/coin.tscn', makeCoinScene());

    // Root scene: Coins → Coin1 (instance). After merge, Coin1 BECOMES the
    // Area3D root, so the AnimationPlayer sits at 'Coins/Coin1/Animation'.
    const nodes: TscnNode[] = [
      {
        name: 'Coins',
        type: 'Node3D',
        children: [
          { name: 'Coin1', type: 'Node3D', instance: 'ExtResource("coin")', children: [], properties: { name: 'Coin1' } as Record<string, unknown> },
        ],
        properties: { name: 'Coins' } as Record<string, unknown>,
      },
    ];

    await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: 'coin', path: 'res://coin/coin.tscn', type: 'PackedScene' }]}
        >
          <SelectionProvider>
            <AnimationTransportProvider>
              <Capture />
              <NodeDispatcher nodes={nodes} />
            </AnimationTransportProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    // Nothing selected → no player registered → tab hidden.
    await setSelection(null);
    expect(transport.hasPlayer).toBe(false);

    // Selecting the COLLAPSED path activates the instanced player.
    await setSelection('Coins/Coin1/Animation');
    expect(transport.hasPlayer).toBe(true);
    expect(transport.clips).toContain('slide');

    // The OLD wrapper path (with the redundant 'Coin' segment) no longer
    // matches any player — proving the wrapper level is genuinely gone.
    await setSelection('Coins/Coin1/Coin/Animation');
    expect(transport.hasPlayer).toBe(false);
  });
});
