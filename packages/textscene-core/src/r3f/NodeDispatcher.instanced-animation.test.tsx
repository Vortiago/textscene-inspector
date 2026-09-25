/**
 * ADR-0012 and ADR-0013: an AnimationPlayer inside an instanced sub-scene binds
 * the Animation transport through the merged path `Coins/Coin1/Animation`,
 * which Godot shows, and not through `Coins/Coin1/Coin/Animation`.
 */
import { describe, expect, it } from 'vitest';
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
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { AnimationProcessMode, MethodCallMode } from '../nodes/animation/animationplayer/types';

import './nodes/index';

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
      callback_mode_process: AnimationProcessMode.IDLE,
      callback_mode_method: MethodCallMode.DEFERRED,
      active: true,
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
    const fake = createFakeResourceLoader();
    fake.scenes.seed('res://coin/coin.tscn', makeCoinScene());

    // Root scene: Coins → Coin1 (instance). After merge, Coin1 becomes the
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
      <ResourceLoaderProvider loader={fake.loader}>
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

    // Selecting the collapsed path activates the instanced player.
    await setSelection('Coins/Coin1/Animation');
    expect(transport.hasPlayer).toBe(true);
    expect(transport.clips).toContain('slide');

    // The wrapper path, with the 'Coin' segment, matches no player.
    await setSelection('Coins/Coin1/Coin/Animation');
    expect(transport.hasPlayer).toBe(false);
  });
});
