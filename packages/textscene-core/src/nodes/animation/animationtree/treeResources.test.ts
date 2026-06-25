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
