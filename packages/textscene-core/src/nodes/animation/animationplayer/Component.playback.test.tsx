/**
 * AnimationPlayer playback integration tests (E) — the Component drives a
 * sibling object's transform through a THREE.AnimationMixer rooted at
 * root_node, gated by the scene-level AnimationTransport.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
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

// A single "slide" clip moving Target from x=0 to x=10 over 1 second.
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

// A constant multi-axis "tilt" rotation on Target: with XYZ vs YXZ Euler order
// the resulting quaternion differs, so tests using it pin the order.
const ROT_EULER = [0.3, 0.5, 0.7] as const;
const ROT_INTERNAL: TscnInternalResource[] = [
  { id: 'Lib', type: 'AnimationLibrary', data: { _data: '{\n"tilt": SubResource("RA")\n}' } },
  {
    id: 'RA',
    type: 'Animation',
    data: {
      length: '1.0',
      'tracks/0/type': '"value"',
      'tracks/0/path': 'NodePath("Target:rotation")',
      'tracks/0/keys': `{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(${ROT_EULER[0]}, ${ROT_EULER[1]}, ${ROT_EULER[2]}), Vector3(${ROT_EULER[0]}, ${ROT_EULER[1]}, ${ROT_EULER[2]})]\n}`,
    },
  },
];

function makeAP(overrides: Partial<AnimationPlayerProperties> = {}): TscnNode {
  const props: AnimationPlayerProperties = {
    name: 'AnimationPlayer',
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
    ...overrides,
  };
  return { name: props.name ?? 'AnimationPlayer', type: 'AnimationPlayer', children: [], properties: props };
}

const AP_PATH = 'Root/AnimationPlayer';

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

/**
 * Mount the scene with the AnimationPlayer at AP_PATH. By default it is the
 * SELECTED node (so playback tests treat it as the active player); pass
 * `{ select: ... }` to override (null = nothing selected).
 */
async function mountScene(
  apProps: Partial<AnimationPlayerProperties> = {},
  internal: TscnInternalResource[] = INTERNAL,
  { select = AP_PATH }: { select?: string | null } = {}
) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internal}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <Capture />
          <group name="Root">
            <NodePathProvider path={AP_PATH}>
              <AnimationPlayer node={makeAP(apProps)} />
            </NodePathProvider>
            <mesh name="Target">
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial />
            </mesh>
          </group>
        </AnimationTransportProvider>
      </SelectionProvider>
    </SceneResourcesProvider>
  );
  await setSelection(select);
  return renderer;
}

function targetX(renderer: Awaited<ReturnType<typeof mountScene>>): number {
  return renderer.scene.findByProps({ name: 'Target' }).instance.position.x;
}

describe('AnimationPlayer playback (E)', () => {
  it('applies nothing while stopped — target keeps its authored transform (E1)', async () => {
    const renderer = await mountScene();
    await renderer.advanceFrames(2, 0.5);
    expect(targetX(renderer)).toBeCloseTo(0);
  });

  it('drives the target while playing (E2)', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5); // t=0.5 -> x=5
    expect(targetX(renderer)).toBeCloseTo(5, 1);
  });

  it('scales the advance rate by speed_scale (E3)', async () => {
    const renderer = await mountScene({ speed_scale: 2.0 });
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // 0.25 * 2 = 0.5 -> x=5
    expect(targetX(renderer)).toBeCloseTo(5, 1);
  });

  it('stacks the preview playbackSpeed multiplier on top of speed_scale (#224)', async () => {
    const renderer = await mountScene({ speed_scale: 2.0 });
    await ReactThreeTestRenderer.act(async () => transport.setPlaybackSpeed(2));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // 0.25 * 2 (speed_scale) * 2 (preview) = 1.0 -> clamped x=10
    expect(targetX(renderer)).toBeCloseTo(10, 1);
  });

  it('samples the seeked time while paused (E4)', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.1);
    await ReactThreeTestRenderer.act(async () => transport.pause());
    await ReactThreeTestRenderer.act(async () => transport.seek(0.8));
    await renderer.advanceFrames(1, 0); // apply pose at t=0.8 -> x=8
    expect(targetX(renderer)).toBeCloseTo(8, 1);
  });

  it('registers its clips only when it is the selected player (C)', async () => {
    const renderer = await mountScene({}, INTERNAL, { select: null });
    expect(transport.clips).toEqual([]); // not selected -> not registered
    await setSelection(AP_PATH);
    expect(transport.clips).toEqual(['slide']); // selected -> registered
    await renderer.unmount();
  });

  it('does not drive the scene while another node is selected (C)', async () => {
    const renderer = await mountScene({}, INTERNAL, { select: 'Root/SomethingElse' });
    // Even if the transport is told to play, a deselected player ignores it.
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(2, 0.5);
    expect(targetX(renderer)).toBeCloseTo(0);
  });

  it('applies nothing while `active` is false, however it is told to play', async () => {
    // animation_player.cpp:664 — `seek_internal` opens with `if (!active) {
    // return; }`, so the scrub this transport performs is refused outright,
    // not merely the runtime process callback (animation_mixer.cpp:446-455).
    const renderer = await mountScene({ active: false });
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(2, 0.5);
    expect(targetX(renderer)).toBeCloseTo(0);
  });

  it('refuses a paused scrub while `active` is false', async () => {
    const renderer = await mountScene({ active: false });
    await ReactThreeTestRenderer.act(async () => transport.pause());
    await ReactThreeTestRenderer.act(async () => transport.seek(0.8));
    await renderer.advanceFrames(1, 0);
    expect(targetX(renderer)).toBeCloseTo(0);
  });

  it('still registers an inactive player\'s clips — Godot lists them, it only refuses to seek', async () => {
    await mountScene({ active: false });
    expect(transport.clips).toEqual(['slide']);
  });

  it('stops and restores the authored pose when it loses selection (C)', async () => {
    const renderer = await mountScene(); // selected by default
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(targetX(renderer)).toBeGreaterThan(1);
    await setSelection('Root/SomethingElse'); // deselect the player
    await renderer.advanceFrames(1, 0);
    expect(targetX(renderer)).toBeCloseTo(0);
  });

  it('composes 3D rotation in Godot YXZ Euler order (fidelity)', async () => {
    const renderer = await mountScene({ autoplay: 'tilt' }, ROT_INTERNAL);
    const target = renderer.scene.findByProps({ name: 'Target' }).instance as THREE.Object3D;
    expect(target.rotation.order).toBe('YXZ');

    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);

    const expected = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(ROT_EULER[0], ROT_EULER[1], ROT_EULER[2], 'YXZ')
    );
    expect(target.quaternion.angleTo(expected)).toBeLessThan(1e-3);
  });

  it('reorders rotation targets to YXZ even while never selected (ADR-0019 registry consumers)', async () => {
    // An AnimationTree can play this player's published clips on the same root
    // without the player ever being active, so the orientation-preserving
    // reorder must not be gated on selection.
    const renderer = await mountScene({}, ROT_INTERNAL, { select: null });
    const target = renderer.scene.findByProps({ name: 'Target' }).instance as THREE.Object3D;
    expect(target.rotation.order).toBe('YXZ');
    await renderer.unmount();
  });

  it('restores the authored pose on stop (E5)', async () => {
    const renderer = await mountScene();
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(targetX(renderer)).toBeGreaterThan(1);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await renderer.advanceFrames(1, 0);
    expect(targetX(renderer)).toBeCloseTo(0);
  });
});

describe('AnimationPlayer playback — loop override (#224)', () => {
  // Authored to loop linearly (loop_mode 1) so 'auto' vs an explicit override
  // produce clearly distinguishable outcomes past the clip's 1s length.
  const LOOPING_INTERNAL: TscnInternalResource[] = [
    { id: 'Lib', type: 'AnimationLibrary', data: { _data: '{\n"slide": SubResource("A")\n}' } },
    {
      id: 'A',
      type: 'Animation',
      data: {
        length: '1.0',
        loop_mode: '1',
        'tracks/0/type': '"value"',
        'tracks/0/path': 'NodePath("Target:position")',
        'tracks/0/keys':
          '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]\n}',
      },
    },
  ];

  it('"auto" respects the authored loop_mode — wraps around past the clip length', async () => {
    const renderer = await mountScene({}, LOOPING_INTERNAL);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5); // 1.5 mod 1.0 = 0.5 -> x=5, not clamped at 10
    expect(targetX(renderer)).toBeCloseTo(5, 1);
  });

  it('"once" forces a single clamped pass even though the clip is authored to loop', async () => {
    const renderer = await mountScene({}, LOOPING_INTERNAL);
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('once'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5); // past the 1s length -> clamped at the final key
    expect(targetX(renderer)).toBeCloseTo(10, 1);
  });

  it('applies a live loop-override flip immediately, without restarting the running clip', async () => {
    const renderer = await mountScene({}, LOOPING_INTERNAL);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.4); // x=4, still mid-first-pass
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('once'));
    await renderer.advanceFrames(1, 0.9); // total 1.3s -> past length -> clamped at 10, not wrapped
    expect(targetX(renderer)).toBeCloseTo(10, 1);
  });

  it('"loop" forces an infinite repeat even on a clip authored with no loop', async () => {
    // Default INTERNAL fixture has no loop_mode (defaults to 0 / no loop).
    const renderer = await mountScene({}, INTERNAL);
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('loop'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 1.5); // would clamp at 10 if not overridden; wraps to x=5 instead
    expect(targetX(renderer)).toBeCloseTo(5, 1);
  });
});
