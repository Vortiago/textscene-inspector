/**
 * Value-track driving (ADR-0016): a stepped `value` track on `Node3D:visible` is sampled and pushed
 * through the AnimatedValue registry as 1 or 0. A probe on the `useAnimatedValue` seam reads it.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { AnimatedValueProvider, useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import { useOptionalSelection, type SelectionContextValue } from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { AnimationPlayerProperties } from './types';

import { AnimationCallbackModeProcess, AnimationCallbackModeMethod } from '../../../godot/scene/animation';

const TARGET_PATH = 'Holder/Target';
const AP_PATH = 'Holder/AnimationPlayer';

// "blink": Target:visible true at 0s, false at 0.5s. No transform tracks.
const INTERNAL: TscnInternalResource[] = [
  {
    id: 'Lib',
    type: 'AnimationLibrary',
    data: { _data: '{\n"blink": SubResource("A")\n}' },
  },
  {
    id: 'A',
    type: 'Animation',
    data: {
      length: '1.0',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Target:visible")',
      'tracks/0/interp': '1',
      'tracks/0/keys': '{\n"times": PackedFloat32Array(0, 0.5),\n"values": [true, false]\n}',
    },
  },
];

function makeAP(): TscnNode {
  const props: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    callback_mode_process: AnimationCallbackModeProcess.IDLE,
    callback_mode_method: AnimationCallbackModeMethod.DEFERRED,
    active: true,
    autoplay: 'blink',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    libraries: [{ name: '', subResourceId: 'Lib' }],
  };
  return {
    rawProperties: {},
    name: 'AnimationPlayer',
    type: 'AnimationPlayer',
    children: [],
    properties: props,
  };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

// Stands in for the target: subscribes to the same `visible` seam the dispatcher uses.
let probedVisible: readonly number[] | null = null;
function VisibleProbe() {
  probedVisible = useAnimatedValue<readonly number[]>('visible', (v) => v);
  return null;
}

async function mount() {
  const fake = createFakeResourceLoader();
  probedVisible = null;
  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: INTERNAL, externalResources: [] }}>
      <AnimatedValueProvider>
        <AnimationTransportProvider>
          <Capture />
          {/* A named ancestor so the player's root_node (`..`) resolves. */}
          <group name="Holder">
            <NodePathProvider path={TARGET_PATH}>
              <VisibleProbe />
            </NodePathProvider>
            <NodePathProvider path={AP_PATH}>
              <AnimationPlayer node={makeAP()} />
            </NodePathProvider>
          </group>
        </AnimationTransportProvider>
      </AnimatedValueProvider>
    </SceneStack>
  );
}

const settle = () => ReactThreeTestRenderer.act(async () => {});
const select = (path: string | null) =>
  ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));

describe('AnimationPlayer drives Node3D:visible (ADR-0016)', () => {
  it('pushes nothing while the player is not driving', async () => {
    await mount();
    expect(probedVisible).toBeNull();
  });

  it('pushes 1 before the key that hides, and 0 after it', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.25);
    await r.advanceFrames(1, 0);
    await settle();
    const before = probedVisible;
    await r.advanceFrames(1, 0.5);
    await r.advanceFrames(1, 0);
    await settle();
    expect([before, probedVisible]).toEqual([[1], [0]]);
  });

  it('releases the target on stop', async () => {
    const r = await mount();
    await select(AP_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.75);
    await r.advanceFrames(1, 0);
    await settle();
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await settle();
    expect(probedVisible).toBeNull();
  });
});
