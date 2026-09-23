/**
 * Frame-track driving (ADR-0016): a `value` track on `Sprite2D:frame` advances a sibling sprite's
 * sheet frame through the AnimatedValue registry, since the THREE mixer drives transforms only. The
 * observable is the Sprite2D's `map.offset.x = frame / hframes` (composeFrameTexture).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { Sprite2D } from '../../2d/sprite2d/Component';
import { parseSprite2D } from '../../2d/sprite2d/parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { AnimatedValueProvider } from '../../../r3f/contexts/AnimatedValueContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import {
  SelectionProvider,
  useOptionalSelection,
  type SelectionContextValue,
} from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { AnimationPlayerProperties } from './types';
import { AnimationProcessMode, MethodCallMode } from './types';

const SPRITE_PATH = 'Coin/Sprite2D';
const AP_PATH = 'Coin/AnimationPlayer';
const TEX = 'res://coin.png';

// "spin": Sprite2D:frame stepping 0 → 1 → 2 → 3 over 0.4s (no transform tracks).
// "still": a clip with no frame tracks (to test release on clip switch).
const INTERNAL: TscnInternalResource[] = [
  {
    id: 'Lib',
    type: 'AnimationLibrary',
    data: { _data: '{\n"spin": SubResource("A"),\n"still": SubResource("B")\n}' },
  },
  {
    id: 'A',
    type: 'Animation',
    data: {
      length: '0.4',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Sprite2D:frame")',
      'tracks/0/keys':
        '{\n"times": PackedFloat32Array(0, 0.1, 0.2, 0.3),\n"values": [0, 1, 2, 3]\n}',
    },
  },
  { id: 'B', type: 'Animation', data: { length: '0.4' } },
];

const spriteHeading = { type: 'node', attributes: { type: 'Sprite2D', name: 'Sprite2D' } };

function makeAP(): TscnNode {
  const props: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    callback_mode_process: AnimationProcessMode.IDLE,
    callback_mode_method: MethodCallMode.DEFERRED,
    active: true,
    autoplay: 'spin',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    libraries: [{ name: '', subResourceId: 'Lib' }],
  };
  return { name: 'AnimationPlayer', type: 'AnimationPlayer', children: [], properties: props };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

async function mount() {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 16, height: 16 };
  fake.textures.seed(TEX, tex);
  const sprite: TscnNode = {
    name: 'Sprite2D',
    type: 'Sprite2D',
    children: [],
    properties: parseSprite2D(spriteHeading, {
      texture: 'ExtResource("1")',
      hframes: '4',
      frame: '0',
    }),
  };
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={INTERNAL}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
      >
        <AnimatedValueProvider>
          <SelectionProvider>
            <AnimationTransportProvider>
              <Capture />
              {/* A named ancestor so the player's root_node (`..`) resolves. */}
              <group name="Coin">
                <NodePathProvider path={SPRITE_PATH}>
                  <Sprite2D node={sprite} />
                </NodePathProvider>
                <NodePathProvider path={AP_PATH}>
                  <AnimationPlayer node={makeAP()} />
                </NodePathProvider>
              </group>
            </AnimationTransportProvider>
          </SelectionProvider>
        </AnimatedValueProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function spriteFrameOffsetX(r: Awaited<ReturnType<typeof mount>>): number {
  const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
  const map = (mesh.material as THREE.MeshBasicMaterial).map;
  return map?.offset.x ?? -1;
}

const settle = () => ReactThreeTestRenderer.act(async () => {});
const select = (path: string | null) =>
  ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));

describe('AnimationPlayer drives Sprite2D:frame (ADR-0016)', () => {
  it('shows the authored frame while the player is not driving', async () => {
    const r = await mount();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0, 5); // frame 0 of 4 hframes
  });

  it('advances the sprite sheet frame while the player plays', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.25); // mixer playhead → 0.25s
    await r.advanceFrames(1, 0); // let the frame sampler read the updated playhead
    await settle();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0.5, 5); // stepped frame 2 / 4
  });

  it('releases the sprite to its authored frame on stop', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.25);
    await r.advanceFrames(1, 0);
    await settle();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0.5, 5);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await settle();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0, 5); // back to authored frame 0
  });

  it('releases the sprite when switched to a clip with no frame tracks', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.25);
    await r.advanceFrames(1, 0);
    await settle();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0.5, 5); // playing spin → frame 2
    await ReactThreeTestRenderer.act(async () => transport.selectClip('still'));
    await settle();
    expect(spriteFrameOffsetX(r)).toBeCloseTo(0, 5); // no frame tracks → authored frame 0
  });
});
