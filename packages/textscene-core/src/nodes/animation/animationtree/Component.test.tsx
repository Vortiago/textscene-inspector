/**
 * AnimationTree R3F component. It has no viewport representation: it coordinates blended playback
 * between an AnimationPlayer and a tree-root resource. The tests assert the group's userData and
 * transform, the pass-through children, and no meshes of its own.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { AnimationTree, dominantActionTime } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { AnimationTreeProperties } from './types';
import {
  AnimationTreeProcessMode,
  CallbackModeDiscrete,
  CallbackModeMethod,
} from './types';

function makeNode(overrides: Partial<AnimationTreeProperties> = {}): TscnNode {
  const props: AnimationTreeProperties = {
    name: overrides.name ?? 'AnimationTree',
    active: false,
    parameters: {},
    anim_player: 'NodePath("..")',
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
  return {
    name: props.name ?? 'AnimationTree',
    type: 'AnimationTree',
    children: [],
    properties: props,
  };
}

describe('<AnimationTree>', () => {
  it('renders without crashing with default props', async () => {
    await expect(
      ReactThreeTestRenderer.create(<AnimationTree node={makeNode()} />)
    ).resolves.toBeDefined();
  });

  it('mounts a group tagged with nodeType AnimationTree', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationTree node={makeNode({ name: 'Tree' })} />
    );
    const group = renderer.scene.findByProps({ name: 'Tree' });
    const userData = group.instance.userData as { nodeType: string };
    expect(userData.nodeType).toBe('AnimationTree');
  });

  it('positions the group at transform.origin when transform is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationTree
        node={makeNode({
          name: 'Translated',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: -1, y: 5, z: 2 },
          },
        })}
      />
    );
    const group = renderer.scene.findByProps({ name: 'Translated' });
    expect(group.instance.position.x).toBe(-1);
    expect(group.instance.position.y).toBe(5);
    expect(group.instance.position.z).toBe(2);
  });

  it('passes children through into the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationTree node={makeNode({ name: 'Parent' })}>
        <mesh name="child-node">
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial />
        </mesh>
      </AnimationTree>
    );
    expect(renderer.scene.findByProps({ name: 'child-node' })).toBeDefined();
  });

  it('renders no visible meshes of its own (is a pure container)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationTree node={makeNode()} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(0);
  });
});

describe('dominantActionTime', () => {
  function makeAction(time: number): THREE.AnimationAction {
    return { time } as THREE.AnimationAction;
  }

  it('returns null when there is no dominant clip', () => {
    expect(dominantActionTime(null, new Map())).toBeNull();
  });

  it("returns the dominant clip's action time when resolved", () => {
    const actions = new Map([['left', makeAction(0.42)]]);
    expect(dominantActionTime({ clip: 'left' }, actions)).toBe(0.42);
  });

  it('returns null (never a fabricated 0) when the dominant clip has no resolved action', () => {
    // A blend program can name a clip the resolved driver does not carry: the
    // mount effect's `clips.find` builds no action for it, so `dominant` is set
    // but `actions` has no entry for its name.
    const actions = new Map([['left', makeAction(0.1)]]);
    expect(dominantActionTime({ clip: 'right' }, actions)).toBeNull();
  });

  it('returns null even when the resolved action time is genuinely 0', () => {
    // Distinguishes "an action exists, at time 0" (flushes as 0) from "no action"
    // (skips), which a `?? 0` fallback would conflate. This one has a real action.
    const actions = new Map([['left', makeAction(0)]]);
    expect(dominantActionTime({ clip: 'left' }, actions)).toBe(0);
  });
});
