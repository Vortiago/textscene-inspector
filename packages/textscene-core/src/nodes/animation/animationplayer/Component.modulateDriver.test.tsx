/**
 * Value-track driving for continuous properties (ADR-0017): an AnimationPlayer
 * `value` track targeting `Decal:modulate` fades a sibling decal's colour/alpha
 * through the AnimatedValue registry — the THREE mixer drives transforms only,
 * so `modulate` is sampled (linearly interpolated) and pushed to the target's
 * registered setter.
 *
 * The observable is the value the driver PUSHES for that node+property, read via
 * a probe registered at the decal's path (the same `useAnimatedValue` seam the
 * Decal component itself consumes). The decal's own render is a projection baked
 * imperatively onto scene geometry — invisible to the test-renderer — so the
 * pushed value, not a material, is what this test inspects. `modulate.a` is what
 * a decal folds into its projection opacity (`albedo_mix × modulate.a`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import {
  AnimatedValueProvider,
  useAnimatedValue,
} from '../../../r3f/contexts/AnimatedValueContext';
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
    callback_mode_process: AnimationProcessMode.IDLE,
    callback_mode_method: MethodCallMode.DEFERRED,
    active: true,
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

// Stands in for the Decal target: subscribes to the SAME `modulate` value seam
// the Decal component uses, so it receives whatever the driver pushes for
// `Holder/Decal:modulate`.
let probedModulate: number[] | null = null;
function ModulateProbe() {
  probedModulate = useAnimatedValue<number[]>('modulate', (v) => v);
  return null;
}

async function mount() {
  const fake = createFakeResourceLoader();
  probedModulate = null;
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNAL} externalResources={[]}>
        <AnimatedValueProvider>
          <SelectionProvider>
            <AnimationTransportProvider>
              <Capture />
              {/* A named ancestor so the player's root_node (`..`) resolves. */}
              <group name="Holder">
                <NodePathProvider path={DECAL_PATH}>
                  <ModulateProbe />
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

const settle = () => ReactThreeTestRenderer.act(async () => {});
const select = (path: string | null) =>
  ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));

describe('AnimationPlayer drives Decal:modulate (ADR-0017)', () => {
  it('pushes nothing while the player is not driving — the target keeps its authored modulate', async () => {
    await mount();
    expect(probedModulate).toBeNull();
  });

  it('pushes the interpolated modulate alpha as it fades', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.5); // mixer playhead → 0.5s
    await r.advanceFrames(1, 0); // let the value sampler read the updated playhead
    await settle();
    // alpha lerps 1 → 0 over 1s, so at 0.5s the pushed modulate.a → 0.5.
    expect(probedModulate).not.toBeNull();
    expect(probedModulate![3]).toBeCloseTo(0.5, 2);
  });

  it('releases the target (pushes null) on stop', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.5);
    await r.advanceFrames(1, 0);
    await settle();
    expect(probedModulate![3]).toBeCloseTo(0.5, 2);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await settle();
    expect(probedModulate).toBeNull(); // released → authored modulate shows again
  });
});
