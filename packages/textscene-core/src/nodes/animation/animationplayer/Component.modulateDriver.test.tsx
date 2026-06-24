/**
 * Value-track driving for continuous properties (ADR-0017): an AnimationPlayer
 * `value` track targeting `Decal:modulate` fades a sibling decal's colour/alpha
 * through the AnimatedValue registry — the THREE mixer drives transforms only,
 * so `modulate` is sampled (linearly interpolated) and pushed. Observable: the
 * decal quad's `material.opacity = albedo_mix × modulate.a`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { Decal } from '../../3d/decal/Component';
import { parseDecal } from '../../3d/decal/parser';
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

const DECAL_PATH = 'Holder/Decal';
const AP_PATH = 'Holder/AnimationPlayer';
const TEX = 'res://decal.png';

// "fade": Decal:modulate alpha 1 → 0 over 1s, linear (interp=1). No transform tracks.
const INTERNAL: TscnInternalResource[] = [
  {
    id: 'Lib',
    type: 'AnimationLibrary',
    data: { _data: '{\n"fade": SubResource("A")\n}' },
  },
  {
    id: 'A',
    type: 'Animation',
    data: {
      length: '1.0',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Decal:modulate")',
      'tracks/0/interp': '1',
      'tracks/0/keys':
        '{\n"times": PackedFloat32Array(0, 1),\n"values": [Color(1, 1, 1, 1), Color(1, 1, 1, 0)]\n}',
    },
  },
];

function makeAP(): TscnNode {
  const props: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    playback_process_mode: AnimationProcessMode.IDLE,
    method_call_mode: MethodCallMode.DEFERRED,
    playback_active: true,
    autoplay: 'fade',
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
  const decal: TscnNode = {
    name: 'Decal',
    type: 'Decal',
    children: [],
    properties: parseDecal(
      { type: 'node', attributes: { type: 'Decal', name: 'Decal' } },
      { texture_albedo: 'ExtResource("1")', albedo_mix: '1.0' }
    ),
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
              <group name="Holder">
                <NodePathProvider path={DECAL_PATH}>
                  <Decal node={decal} />
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

function decalQuadOpacity(r: Awaited<ReturnType<typeof mount>>): number {
  const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
  return (mesh.material as THREE.MeshBasicMaterial).opacity;
}

const settle = () => ReactThreeTestRenderer.act(async () => {});
const select = (path: string | null) =>
  ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));

describe('AnimationPlayer drives Decal:modulate (ADR-0017)', () => {
  it('shows the authored modulate while the player is not driving', async () => {
    const r = await mount();
    expect(decalQuadOpacity(r)).toBeCloseTo(1, 5); // authored modulate.a = 1 × albedo_mix 1
  });

  it('fades the decal opacity as the modulate alpha interpolates', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.5); // mixer playhead → 0.5s
    await r.advanceFrames(1, 0); // let the value sampler read the updated playhead
    await settle();
    // alpha lerps 1 → 0 over 1s, so at 0.5s → 0.5; opacity = albedo_mix(1) × 0.5
    expect(decalQuadOpacity(r)).toBeCloseTo(0.5, 2);
  });

  it('releases the decal to its authored modulate on stop', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.5);
    await r.advanceFrames(1, 0);
    await settle();
    expect(decalQuadOpacity(r)).toBeCloseTo(0.5, 2);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await settle();
    expect(decalQuadOpacity(r)).toBeCloseTo(1, 5); // back to authored modulate.a = 1
  });
});
