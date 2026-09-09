/**
 * Tree-root resource resolution tests.
 *
 * `resolveTreeRoot` turns an AnimationTree's `tree_root` SubResource reference
 * into a typed `AnimNode` graph by following the AnimationNode* SubResources
 * and a BlendTree's `node_connections`. THREE-free / React-free, like
 * `resolveAnimations`.
 */

import { describe, it, expect } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveTreeRoot } from './treeResources';

function res(
  id: string,
  type: string,
  data: Record<string, unknown>
): TscnInternalResource {
  return { id, type, data };
}

describe('resolveTreeRoot — leaves', () => {
  it('resolves an AnimationNodeAnimation reference to an animation leaf', () => {
    const resources = [res('17', 'AnimationNodeAnimation', { animation: '&"idle"' })];
    const root = resolveTreeRoot('SubResource("17")', resources);
    expect(root).toEqual({ kind: 'animation', clip: 'idle' });
  });
});

describe('resolveTreeRoot — blend tree', () => {
  it('wires a Blend2 from output through node_connections to its two clips', () => {
    const resources = [
      res('idle', 'AnimationNodeAnimation', { animation: '&"idle"' }),
      res('walk', 'AnimationNodeAnimation', { animation: '&"walk"' }),
      res('blend', 'AnimationNodeBlend2', {}),
      res('tree', 'AnimationNodeBlendTree', {
        'nodes/mix/node': 'SubResource("blend")',
        'nodes/a/node': 'SubResource("idle")',
        'nodes/b/node': 'SubResource("walk")',
        node_connections: '[&"output", 0, &"mix", &"mix", 0, &"a", &"mix", 1, &"b"]',
      }),
    ];

    const root = resolveTreeRoot('SubResource("tree")', resources);

    expect(root).toEqual({
      kind: 'blend2',
      name: 'mix',
      filtered: false,
      in0: { kind: 'animation', clip: 'idle' },
      in1: { kind: 'animation', clip: 'walk' },
    });
  });

  it('threads a TimeScale node through to its single input', () => {
    const resources = [
      res('run', 'AnimationNodeAnimation', { animation: '&"run"' }),
      res('ts', 'AnimationNodeTimeScale', {}),
      res('tree', 'AnimationNodeBlendTree', {
        'nodes/scale/node': 'SubResource("ts")',
        'nodes/clip/node': 'SubResource("run")',
        node_connections: '[&"output", 0, &"scale", &"scale", 0, &"clip"]',
      }),
    ];

    const root = resolveTreeRoot('SubResource("tree")', resources);

    expect(root).toEqual({
      kind: 'timescale',
      name: 'scale',
      input: { kind: 'animation', clip: 'run' },
    });
  });
});

describe('resolveTreeRoot — state machine', () => {
  it('resolves states and picks the Start-transition target as the start state', () => {
    const resources = [
      res('idle', 'AnimationNodeAnimation', { animation: '&"idle"' }),
      res('walk', 'AnimationNodeAnimation', { animation: '&"walk"' }),
      res('sm', 'AnimationNodeStateMachine', {
        'states/idle/node': 'SubResource("idle")',
        'states/walk/node': 'SubResource("walk")',
        transitions: '["Start", "walk", SubResource("t1")]',
      }),
    ];

    const root = resolveTreeRoot('SubResource("sm")', resources);

    expect(root).toEqual({
      kind: 'statemachine',
      name: '',
      startState: 'walk',
      states: [
        { name: 'idle', node: { kind: 'animation', clip: 'idle' } },
        { name: 'walk', node: { kind: 'animation', clip: 'walk' } },
      ],
    });
  });
});

/**
 * A BlendTree may hold another BlendTree, and nothing in the engine stops that
 * chain closing on itself: `add_node` guards only the name, null and `/`
 * (animation_blend_tree.cpp:1489-1493) and `connect_node` only a node feeding
 * itself (:1615-1619). So a cycle is a file Godot writes out and reloads, and
 * `resolveTreeRoot` runs inside a render-phase `useMemo` with no error boundary
 * above it — a stack overflow here blanks the whole preview.
 */
describe('resolveTreeRoot — cyclic sub-resource references', () => {
  it('yields no root for a BlendTree that holds itself', () => {
    const resources = [
      res('A', 'AnimationNodeBlendTree', {
        'nodes/Self/node': 'SubResource("A")',
        node_connections: '[&"output", 0, &"Self"]',
      }),
    ];

    expect(resolveTreeRoot('SubResource("A")', resources)).toBeNull();
  });

  it('yields no root for two BlendTrees that hold each other', () => {
    const resources = [
      res('A', 'AnimationNodeBlendTree', {
        'nodes/Nested/node': 'SubResource("B")',
        node_connections: '[&"output", 0, &"Nested"]',
      }),
      res('B', 'AnimationNodeBlendTree', {
        'nodes/Back/node': 'SubResource("A")',
        node_connections: '[&"output", 0, &"Back"]',
      }),
    ];

    expect(resolveTreeRoot('SubResource("A")', resources)).toBeNull();
  });

  // The guard is per-PATH, not per-tree: one sub-resource wired into two ports
  // is ordinary reuse, and refusing the second would silence half the blend.
  it('still resolves one clip sub-resource wired into both Blend2 inputs', () => {
    const resources = [
      res('idle', 'AnimationNodeAnimation', { animation: '&"idle"' }),
      res('blend', 'AnimationNodeBlend2', {}),
      res('tree', 'AnimationNodeBlendTree', {
        'nodes/mix/node': 'SubResource("blend")',
        'nodes/a/node': 'SubResource("idle")',
        'nodes/b/node': 'SubResource("idle")',
        node_connections: '[&"output", 0, &"mix", &"mix", 0, &"a", &"mix", 1, &"b"]',
      }),
    ];

    const root = resolveTreeRoot('SubResource("tree")', resources);

    expect(root).toEqual({
      kind: 'blend2',
      name: 'mix',
      filtered: false,
      in0: { kind: 'animation', clip: 'idle' },
      in1: { kind: 'animation', clip: 'idle' },
    });
  });
});
