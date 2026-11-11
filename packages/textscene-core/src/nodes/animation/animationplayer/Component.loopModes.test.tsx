/**
 * The loop modes of an Animation as the AnimationPlayer plays them. The node the mixer drives, the
 * value the registry pushes and the time the transport shows stand on one clip time on every pass.
 * Each expected time is the `current_animation_position` Godot 4.6.3 gives after that many
 * `advance(0.3)` calls on a one-second clip.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { AnimatedValueProvider, useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { RegisteredNode } from '../../../r3f/testing/RegisteredNode';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { AnimationLoopMode } from '../../../godot/scene/animation';
import type { TscnInternalResource } from '../../../parser/types';
import { subResource } from '../../../testing/subResource';
import { animationPlayerNode, LIB_LIBRARY } from './animationPlayerNode.testkit';

const AP_PATH = 'Root/AnimationPlayer';
const FADER_PATH = 'Root/Fader';
const FRAME_SECONDS = 0.3;

/**
 * A one-second clip: `Mover` slides from x 0 to 10 on the mixer, and `Fader` fades from alpha 1 to 0
 * on the registry. `Fader` also flips from frame 0 to frame 1 at 0.5 s, on a discrete track.
 */
function clip(id: string, loopMode: number): TscnInternalResource {
  return subResource('Animation', id, {
    length: '1.0',
    loop_mode: String(loopMode),
    'tracks/0/type': '"value"',
    'tracks/0/path': 'NodePath("Mover:position")',
    'tracks/0/keys':
      '{\n"times": PackedFloat32Array(0, 1),\n"values": [Vector3(0, 0, 0), Vector3(10, 0, 0)]\n}',
    'tracks/1/type': '"value"',
    'tracks/1/path': 'NodePath("Fader:modulate")',
    'tracks/1/keys':
      '{\n"times": PackedFloat32Array(0, 1),\n"values": [Color(1, 1, 1, 1), Color(1, 1, 1, 0)]\n}',
    'tracks/2/type': '"value"',
    'tracks/2/path': 'NodePath("Fader:frame")',
    'tracks/2/keys': '{\n"times": PackedFloat32Array(0, 0.5),\n"update": 1,\n"values": [0, 1]\n}',
  });
}

const INTERNAL: TscnInternalResource[] = [
  subResource('AnimationLibrary', 'Lib', {
    _data: '{\n"once": SubResource("N"),\n"wrap": SubResource("L"),\n"bounce": SubResource("P")\n}',
  }),
  clip('N', AnimationLoopMode.NONE),
  clip('L', AnimationLoopMode.LINEAR),
  clip('P', AnimationLoopMode.PINGPONG),
];

let transport: AnimationTransport;
let fadedAlpha: number | null;
let shownFrame: number | null;
function Probe() {
  transport = useAnimationTransport();
  return null;
}
function FaderProbe() {
  fadedAlpha = useAnimatedValue('modulate', (colour) => colour[3]!);
  shownFrame = useAnimatedValue('frame', (frame) => frame[0]!);
  return null;
}

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
const mounted: Renderer[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

const act = (change: () => void) => ReactThreeTestRenderer.act(async () => change());

/** Mounts the player selected, with `autoplay` as the clip the transport starts on, and plays it. */
async function play(autoplay: string): Promise<Renderer> {
  fadedAlpha = null;
  shownFrame = null;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={createFakeResourceLoader().loader}
      scene={{ internalResources: INTERNAL }}
      selectedPath={AP_PATH}
    >
      <AnimatedValueProvider>
        <AnimationTransportProvider>
          <Probe />
          <group name="Root">
            <RegisteredNode path="Root/Mover">
              <group name="Mover" />
            </RegisteredNode>
            <NodePathProvider path={FADER_PATH}>
              <FaderProbe />
            </NodePathProvider>
            <NodePathProvider path={AP_PATH}>
              <AnimationPlayer node={animationPlayerNode({ autoplay, libraries: LIB_LIBRARY })} />
            </NodePathProvider>
          </group>
        </AnimationTransportProvider>
      </AnimatedValueProvider>
    </SceneStack>
  );
  mounted.push(renderer);
  await act(() => transport.play());
  return renderer;
}

/** Advances `frames` frames of FRAME_SECONDS. React commits after each, as it does between the frames of a browser. */
async function advance(renderer: Renderer, frames: number): Promise<void> {
  for (let frame = 0; frame < frames; frame++) {
    await renderer.advanceFrames(1, FRAME_SECONDS);
    await act(() => {});
  }
}

async function pause(renderer: Renderer): Promise<void> {
  await act(() => transport.pause());
  await advance(renderer, 1);
}

/** The clip time each of the three readers stands on: the mixer's node, the pushed value and the transport. */
async function playheads(renderer: Renderer): Promise<{ mixer: number; pushed: number; shown: number }> {
  const mixer = renderer.scene.findByProps({ name: 'Mover' }).instance.position.x / 10;
  const pushed = 1 - fadedAlpha!;
  // The transport throttles a report, and a pause flushes the exact time.
  await pause(renderer);
  return { mixer, pushed, shown: transport.time };
}

function allAt(time: number) {
  const close = expect.closeTo(time, 5);
  return { mixer: close, pushed: close, shown: close };
}

describe('AnimationPlayer loop modes', () => {
  it('holds the end of a clip that does not loop', async () => {
    const renderer = await play('once');
    await advance(renderer, 5);
    expect(await playheads(renderer)).toEqual(allAt(1));
  });

  it('wraps a linear loop to the start', async () => {
    const renderer = await play('wrap');
    await advance(renderer, 4);
    expect(await playheads(renderer)).toEqual(allAt(0.2));
  });

  it('runs a ping-pong loop back from the end', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 4);
    expect(await playheads(renderer)).toEqual(allAt(0.8));
  });

  it('runs a ping-pong loop forward again from the start', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 8);
    expect(await playheads(renderer)).toEqual(allAt(0.4));
  });

  it('scrubs the return pass of a ping-pong loop to the time asked for', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 4);
    await pause(renderer);
    await act(() => transport.seek(0.25));
    await advance(renderer, 1);
    expect(await playheads(renderer)).toEqual(allAt(0.25));
  });

  it('plays forward when a ping-pong loop resumes from a pause on its return pass', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 4);
    await pause(renderer);
    await act(() => transport.play());
    await advance(renderer, 1);
    expect(await playheads(renderer)).toEqual(allAt(0.9));
  });

  it('plays forward when the Loop override takes over the return pass of a ping-pong loop', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 4);
    await act(() => transport.setLoopOverride('loop'));
    await advance(renderer, 1);
    expect(await playheads(renderer)).toEqual(allAt(0.1));
  });

  it('plays forward when a ping-pong loop takes over from the Loop override', async () => {
    const renderer = await play('bounce');
    await act(() => transport.setLoopOverride('loop'));
    await advance(renderer, 5);
    await act(() => transport.setLoopOverride('auto'));
    await advance(renderer, 1);
    expect(await playheads(renderer)).toEqual(allAt(0.8));
  });

  it('holds the key a discrete track crossed when a ping-pong loop pauses on its return pass', async () => {
    const renderer = await play('bounce');
    await advance(renderer, 6);
    await pause(renderer);
    // The pause flushes the clip time to the transport, which comes back as a seek one frame on.
    await advance(renderer, 1);
    expect(shownFrame).toBe(1);
  });

  it('holds the end of a looping clip under the Once override', async () => {
    const renderer = await play('bounce');
    await act(() => transport.setLoopOverride('once'));
    await advance(renderer, 5);
    expect(await playheads(renderer)).toEqual(allAt(1));
  });
});
