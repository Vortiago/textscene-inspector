/**
 * AnimationTree playback (ADR-0019): a selected, `active = true` tree resolves `anim_player` to a
 * registered driver, evaluates its blend tree at the authored parameter state and drives the
 * driver's object with weighted actions. It drives only while selected and active.
 */

import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationTree } from './Component';
import type { AnimationTreeProperties } from './types';
import { AnimationTreeProcessMode, CallbackModeDiscrete, CallbackModeMethod } from './types';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';
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
import { AnimationDriverProvider, useRegisterDriver } from '../../../r3f/contexts/AnimationDriverContext';
import { subtreeObjects } from '../../../r3f/animation/poseSnapshot';

const TREE_PATH = 'Root/Tree';
const DRIVER_PATH = 'Root/Player';

/** Driver object: a root group with a movable child, plus two opposing clips. */
function makeDriver(): {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
} {
  const object = new THREE.Group();
  object.name = 'DriverRoot';
  const mover = new THREE.Object3D();
  mover.name = 'Mover';
  object.add(mover);
  // 'left' drives Mover.x 0 -> -10 over 1s; 'right' drives 0 -> +10.
  const left = new THREE.AnimationClip('left', 1, [
    new THREE.VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, -10, 0, 0]),
  ]);
  const right = new THREE.AnimationClip('right', 1, [
    new THREE.VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, 10, 0, 0]),
  ]);
  return { object, clips: [left, right] };
}

function moverX(object: THREE.Object3D): number {
  const mover = object.getObjectByName('Mover');
  if (!mover) throw new Error('Mover not found');
  return mover.position.x;
}

// A Blend2(in0='left', in1='right') BlendTree, blendable through parameters/mix/blend_amount.
const RESOURCES: TscnInternalResource[] = [
  {
    id: 'left',
    type: 'AnimationNodeAnimation',
    data: { animation: '&"left"' },
  },
  {
    id: 'right',
    type: 'AnimationNodeAnimation',
    data: { animation: '&"right"' },
  },
  {
    id: 'ghost',
    type: 'AnimationNodeAnimation',
    data: { animation: '&"ghost"' },
  },
  { id: 'blend', type: 'AnimationNodeBlend2', data: {} },
  { id: 'ts', type: 'AnimationNodeTimeScale', data: {} },
  {
    id: 'tree',
    type: 'AnimationNodeBlendTree',
    data: {
      'nodes/a/node': 'SubResource("left")',
      'nodes/b/node': 'SubResource("right")',
      'nodes/mix/node': 'SubResource("blend")',
      node_connections: '[&"output", 0, &"mix", &"mix", 0, &"a", &"mix", 1, &"b"]',
    },
  },
  // Blend2(in0='left', in1='ghost'): a clip the driver lacks, dominant past blend_amount 0.5.
  {
    id: 'tree_ghost',
    type: 'AnimationNodeBlendTree',
    data: {
      'nodes/a/node': 'SubResource("left")',
      'nodes/g/node': 'SubResource("ghost")',
      'nodes/mix/node': 'SubResource("blend")',
      node_connections: '[&"output", 0, &"mix", &"mix", 0, &"a", &"mix", 1, &"g"]',
    },
  },
  // A timescale variant feeding the 'right' clip, wired output -> scale -> right.
  {
    id: 'tree_ts',
    type: 'AnimationNodeBlendTree',
    data: {
      'nodes/b/node': 'SubResource("right")',
      'nodes/scale/node': 'SubResource("ts")',
      node_connections: '[&"output", 0, &"scale", &"scale", 0, &"b"]',
    },
  },
];

function makeTreeNode(overrides: Partial<AnimationTreeProperties> = {}): TscnNode {
  const props: AnimationTreeProperties = {
    name: 'Tree',
    active: true,
    tree_root: 'SubResource("tree")',
    parameters: {},
    anim_player: 'NodePath("../Player")',
    process_callback: AnimationTreeProcessMode.IDLE,
    callback_mode_process: AnimationTreeProcessMode.IDLE,
    callback_mode_method: CallbackModeMethod.DEFERRED,
    callback_mode_discrete: CallbackModeDiscrete.DOMINANT,
    root_motion_track: 'NodePath("")',
    advance_expression_base_node: 'NodePath("..")',
    audio_max_polyphony: 32,
    root_node: 'NodePath("..")',
    deterministic: false,
    reset_on_save: true,
    root_motion_local: false,
    ...overrides,
  };
  return { rawProperties: {}, name: 'Tree', type: 'AnimationTree', children: [], properties: props };
}

let transport: AnimationTransport;
let selection: SelectionContextValue | null;
function Capture() {
  transport = useAnimationTransport();
  selection = useOptionalSelection();
  return null;
}

function RegisterDriver({ object, clips }: { object: THREE.Object3D; clips: THREE.AnimationClip[] }) {
  const registerDriver = useRegisterDriver();
  // glTF-style ready-made clips, bound by name, as GLBSceneRoot publishes them.
  useEffect(
    () =>
      registerDriver(DRIVER_PATH, {
        object,
        clips,
        bind: () => ({
          clips,
          targets: subtreeObjects(object),
          isStale: () => false,
        }),
      }),
    [registerDriver, object, clips]
  );
  return null;
}

async function setSelection(path: string | null) {
  await ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));
}

async function mountTree(
  driver: { object: THREE.Object3D; clips: THREE.AnimationClip[] },
  node: TscnNode,
  { select = TREE_PATH }: { select?: string | null } = {}
) {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={RESOURCES}>
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <RegisterDriver object={driver.object} clips={driver.clips} />
            <group name="Root">
              <NodePathProvider path={TREE_PATH}>
                <AnimationTree node={node} />
              </NodePathProvider>
            </group>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    </SceneResourcesProvider>
  );
  await setSelection(select);
  return renderer;
}

describe('AnimationTree — transport registration', () => {
  it('shows the Animation tab only while selected and active', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode(), { select: null });
    expect(transport.hasPlayer).toBe(false);

    await setSelection(TREE_PATH);
    expect(transport.hasPlayer).toBe(true);
    await renderer.unmount();
  });

  it('does not register when active is false, even if selected', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode({ active: false }), {
      select: TREE_PATH,
    });
    expect(transport.hasPlayer).toBe(false);
    await renderer.unmount();
  });
});

describe('AnimationTree — weighted blend playback', () => {
  it('drives the resolved driver with a weighted blend of two clips', async () => {
    const driver = makeDriver();
    // blend_amount 0.75 -> left weight 0.25, right weight 0.75 (total 1).
    // At t=0.5: left=-5, right=5; weighted blend -> 0.25*(-5) + 0.75*(5) = 2.5.
    const renderer = await mountTree(driver, makeTreeNode({ parameters: { 'mix/blend_amount': '0.75' } }));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(moverX(driver.object)).toBeCloseTo(2.5, 0);
    await renderer.unmount();
  });

  it('plays only input 0 at the default blend_amount (full left)', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode());
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5); // t=0.5 -> left x=-5
    expect(moverX(driver.object)).toBeCloseTo(-5, 0);
    await renderer.unmount();
  });

  it('preserves blend weights when paused and seeked (not over-blended)', async () => {
    const driver = makeDriver();
    // Stopped → pause → seek (no prior playing frame). Weights must be applied:
    // at t=0.5 the 0.25/0.75 blend gives 2.5, not the unweighted average 0.
    const renderer = await mountTree(driver, makeTreeNode({ parameters: { 'mix/blend_amount': '0.75' } }));
    await ReactThreeTestRenderer.act(async () => transport.pause());
    await ReactThreeTestRenderer.act(async () => transport.seek(0.5));
    await renderer.advanceFrames(1, 0);
    expect(moverX(driver.object)).toBeCloseTo(2.5, 0);
    await renderer.unmount();
  });

  it('honors TimeScale — scale 2 advances twice as far in the same wall time', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(
      driver,
      makeTreeNode({
        tree_root: 'SubResource("tree_ts")',
        parameters: { 'scale/scale': '2' },
      })
    );
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // 0.25s wall * scale 2 -> clip t=0.5 -> x=5
    expect(moverX(driver.object)).toBeCloseTo(5, 0);
    await renderer.unmount();
  });

  it('scales the advance rate by the preview playbackSpeed multiplier (#224)', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode());
    await ReactThreeTestRenderer.act(async () => transport.setPlaybackSpeed(2));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.25); // 0.25 * 2 = 0.5 -> left x=-5 (full-left blend)
    expect(moverX(driver.object)).toBeCloseTo(-5, 0);
    await renderer.unmount();
  });
});

describe('AnimationTree — gating and restore', () => {
  it('does not move the driver while stopped', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode());
    await renderer.advanceFrames(2, 0.5);
    expect(moverX(driver.object)).toBeCloseTo(0);
    await renderer.unmount();
  });

  it('does not move the driver when inactive even if played', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode({ active: false }));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(2, 0.5);
    expect(moverX(driver.object)).toBeCloseTo(0);
    await renderer.unmount();
  });

  it('restores the authored pose on stop', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode());
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(Math.abs(moverX(driver.object))).toBeGreaterThan(1);
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await renderer.advanceFrames(1, 0);
    expect(moverX(driver.object)).toBeCloseTo(0);
    await renderer.unmount();
  });

  it('restores the authored pose when it loses selection mid-playback', async () => {
    const driver = makeDriver();
    const renderer = await mountTree(driver, makeTreeNode());
    await ReactThreeTestRenderer.act(async () => transport.play());
    await renderer.advanceFrames(1, 0.5);
    expect(Math.abs(moverX(driver.object))).toBeGreaterThan(1);
    await setSelection('Root/Elsewhere');
    await renderer.advanceFrames(1, 0);
    expect(moverX(driver.object)).toBeCloseTo(0);
    await renderer.unmount();
  });
});

// While playing, `reportTime` commits at most once per 100 ms of `Date.now`. A frozen clock lets
// the first report through and throttles every later one, so only the pause flush moves the readout.
describe('AnimationTree — paused readout flush', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** One frame, then the transport state the frame set, which `advanceFrames` leaves unflushed. */
  async function frame(renderer: Awaited<ReturnType<typeof mountTree>>, delta: number) {
    await renderer.advanceFrames(1, delta);
    await ReactThreeTestRenderer.act(async () => {});
  }

  async function act(step: () => void) {
    await ReactThreeTestRenderer.act(async () => step());
  }

  it("flushes the dominant clip's live playhead on the playing-to-paused edge", async () => {
    const renderer = await mountTree(makeDriver(), makeTreeNode());
    await act(() => transport.play());
    await frame(renderer, 0.25);
    await frame(renderer, 0.25);
    expect(transport.time).toBeCloseTo(0.25, 5);
    await act(() => transport.pause());
    await frame(renderer, 0);
    expect(transport.time).toBeCloseTo(0.5, 5);
    await renderer.unmount();
  });

  it('keeps the paused readout when the dominant clip has no action, never a fabricated 0', async () => {
    const renderer = await mountTree(
      makeDriver(),
      makeTreeNode({ tree_root: 'SubResource("tree_ghost")', parameters: { 'mix/blend_amount': '0.75' } })
    );
    await act(() => transport.play());
    await frame(renderer, 0);
    await act(() => transport.seek(0.3));
    await frame(renderer, 0);
    await act(() => transport.pause());
    await frame(renderer, 0);
    expect(transport.time).toBeCloseTo(0.3, 5);
    await renderer.unmount();
  });
});
